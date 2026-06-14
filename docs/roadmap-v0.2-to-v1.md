# Trace — Plan de mejoras v0.2 → v1.0

Basado en: security-review.md, self-hosted-all-in-one.md, README.md
y evaluación arquitectónica de la sesión actual.

Fecha: 2026-06-05

---

## Diagnóstico de partida

### Lo que está sólido y no hay que tocar
- Cargo workspace con `trace-core` compartido — decisión arquitectónica correcta
- SQLite como base única desktop + servidor — sin Postgres, sin Redis
- Argon2 para passwords — correcto
- Secreto JWT persistido en SQLite — evita invalidar sesiones al reiniciar
- Headers de seguridad HTTP — CSP, X-Frame-Options, nosniff, etc.
- Rate limiting en `/setup` y `/api/auth/login`
- Backup con checkpoint WAL antes de empaquetar
- Restore con validación de schema SQLite
- Setup de un solo uso — `/setup` → 404 después del primer admin
- CI Linux (.deb + .AppImage) + CI Docker con smoke test de /health
- Estructura de carpetas post-refactor: shell/, features/, hooks/, lib/workspace/

### Los tres problemas reales que bloquean el crecimiento
1. **Dos UIs que van a divergir**: `TraceWebApp.tsx` es una UI paralela al
   shell desktop. Cada feature nueva hay que decidir si va a las dos.
2. **Sesiones sin refresh tokens**: JWT en localStorage sin rotación ni
   revocación. Aceptable para v0.1, bloqueante para release público.
3. **Sin push/pull desktop-servidor**: la parte más valiosa del self-host
   (acceder a tus notas desde el browser y hacer backup desde el desktop)
   todavía no existe como flujo completo.

---

## Bloque A — Fundación estable
### Prioridad: hacer antes de cualquier release público

---

### A1 — Unificar UI web con el shell desktop

**Problema**: `src/web/TraceWebApp.tsx` es una UI separada. No escala.

**Solución**: el mismo `AppShell` del desktop en modo web, con feature flags
que deshabilitan las partes Tauri-específicas.

**Archivos afectados**:
```
src/App.tsx                          ← ya detecta modo web/desktop
src/app/shell/AppShell.tsx           ← añadir prop/context isWebMode
src/app/shell/Sidebar.tsx            ← deshabilitar acciones Tauri en web
src/app/shell/TitleBar.tsx           ← ocultar traffic lights en web
src/features/notes-editor/           ← deshabilitar import/export Tauri en web
src/web/TraceWebApp.tsx              ← reemplazar por AppShell con isWebMode
```

**Implementación**:
```tsx
// src/lib/env.ts — fuente de verdad del modo
export const isTauri = () => '__TAURI_INTERNALS__' in window
export const isWeb   = () => !isTauri()

// Contexto global — no prop drilling
export const EnvContext = React.createContext({ isTauri: false })
```

Componentes que necesitan bifurcación:
- `VaultSelector`: en web muestra vaults del servidor, no selector de carpeta local
- `Sidebar`: nueva nota llama API REST en vez de Tauri command
- `EditorWrapper`: autosave llama API REST en vez de Tauri command
- `ImportExport`: deshabilitar en web hasta tener endpoint de upload

**Criterio de éxito**: borrar `src/web/TraceWebApp.tsx` sin romper nada.

---

### A2 — Refresh tokens + logout real + revocación de sesiones

**Problema actual** (de security-review.md):
> No hay refresh tokens ni revocación de sesiones.
> El token JWT vive en localStorage.

**Diseño**:

```sql
-- Añadir a trace-core schema.rs
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    revoked_at  INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Endpoints nuevos en trace-server**:
```
POST /api/auth/refresh   → recibe refresh token, devuelve nuevo access token
POST /api/auth/logout    → revoca el refresh token activo
```

**Flujo**:
```
Login → access token (15min) + refresh token (30 días, HttpOnly cookie)
Cada request → access token en Authorization header
Access token expira → frontend llama /api/auth/refresh automáticamente
Logout → POST /api/auth/logout → refresh token marcado revoked_at en SQLite
```

**Por qué HttpOnly cookie para el refresh token**:
- El access token puede seguir en memoria JS (no localStorage)
- El refresh token en HttpOnly no es accesible desde JS → XSS no puede robarlo
- Esto resuelve el riesgo de localStorage que menciona security-review.md

**Tarea adicional**: job de limpieza de tokens expirados al arrancar el servidor
```rust
// Al iniciar trace-server, antes de aceptar requests
sqlx::query("DELETE FROM refresh_tokens WHERE expires_at < unixepoch()")
```

---

### A3 — Migrar access token de localStorage a memoria JS

**Problema**: security-review.md nota que localStorage es vulnerable a XSS.

**Solución**: guardar el access token solo en memoria (variable de módulo o
Zustand), nunca en localStorage/sessionStorage.

```ts
// src/lib/auth.ts
let accessToken: string | null = null

export const setAccessToken  = (t: string) => { accessToken = t }
export const getAccessToken  = () => accessToken
export const clearAccessToken = () => { accessToken = null }
```

El refresh token viaja solo en la cookie HttpOnly — el frontend nunca lo toca.
Al recargar la página, el frontend llama `/api/auth/refresh` silenciosamente
usando la cookie; si la cookie existe y es válida, recupera el access token.

---

### A4 — Audit log

**Problema**: security-review.md lo lista como Prioridad 1 del backlog.

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS audit_log (
    id         TEXT PRIMARY KEY,
    event      TEXT NOT NULL,  -- 'login', 'logout', 'setup', 'backup', 'restore'
    user_id    TEXT,
    ip         TEXT,
    detail     TEXT,           -- JSON con contexto adicional
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

**Eventos a registrar**:
| Evento | Cuándo |
|--------|--------|
| `setup.completed` | Admin creado en /setup |
| `auth.login` | Login exitoso |
| `auth.login_failed` | Login fallido (sin revelar si el email existe) |
| `auth.logout` | Logout explícito |
| `backup.created` | Backup descargado |
| `restore.started` | Restore iniciado |
| `restore.completed` | Restore completado |
| `restore.failed` | Restore fallido con razón |

Endpoint de solo lectura para admin: `GET /api/admin/audit-log`

---

### A5 — Validación anti-zip-bomb en restore

**Problema** (de security-review.md):
> Restore ZIP valida que exista trace.db y valida schema,
> pero falta validación contra zip bombs.

**Fix en trace-server**:
```rust
// Antes de extraer cualquier entry del ZIP
const MAX_UNCOMPRESSED: u64 = 2 * 1024 * 1024 * 1024; // 2 GiB
const MAX_FILES: usize = 10_000;

let mut total_size: u64 = 0;
let mut file_count: usize = 0;

for i in 0..archive.len() {
    let file = archive.by_index(i)?;
    file_count += 1;
    total_size += file.size();

    if file_count > MAX_FILES {
        return Err(anyhow!("ZIP contiene demasiados archivos"));
    }
    if total_size > MAX_UNCOMPRESSED {
        return Err(anyhow!("ZIP excede el límite de tamaño descomprimido"));
    }
}
```

---

## Bloque B — Push/pull desktop ↔ servidor
### Prioridad: el feature diferenciador del self-host

---

### B1 — Diseño del modelo de sync (Modelo B confirmado)

Como se decidió en la sesión anterior: **vaults independientes con
operaciones explícitas**. Sin resolución de conflictos automática en v0.2.

```
Desktop (vault local)          Servidor (vault en /data)
      │                               │
      │── push ──→ POST /api/sync/push ──→ merge en servidor
      │                               │
      │←─ pull ←── GET  /api/sync/pull ←── snapshot del servidor
```

**Push**: envía notas modificadas desde `last_push_at` en adelante.
**Pull**: descarga notas del servidor más nuevas que `last_pull_at`.
**Conflicto explícito**: si una nota tiene `updated_at` más reciente en
ambos lados, el usuario elige cuál versión conservar.

---

### B2 — Schema de sync en trace-core

```sql
-- Estado de sync por vault
CREATE TABLE IF NOT EXISTS sync_state (
    id           TEXT PRIMARY KEY DEFAULT 'singleton',
    server_url   TEXT,
    last_push_at INTEGER,
    last_pull_at INTEGER,
    last_sync_ok INTEGER
);

-- Log de operaciones de sync
CREATE TABLE IF NOT EXISTS sync_log (
    id         TEXT PRIMARY KEY,
    direction  TEXT NOT NULL,   -- 'push' | 'pull'
    status     TEXT NOT NULL,   -- 'ok' | 'conflict' | 'error'
    notes_sent INTEGER DEFAULT 0,
    notes_recv INTEGER DEFAULT 0,
    detail     TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

---

### B3 — API de sync en trace-server

```
POST /api/sync/push
  Body: { notes: Note[], since: timestamp }
  Lógica: para cada nota recibida, si updated_at servidor < updated_at cliente → upsert
          si updated_at servidor > updated_at cliente → marcar conflicto
  Response: { accepted: string[], conflicts: ConflictItem[] }

GET /api/sync/pull
  Query: ?since=timestamp
  Response: { notes: Note[], server_time: timestamp }

GET /api/sync/status
  Response: { last_push: timestamp, last_pull: timestamp, pending_conflicts: number }
```

---

### B4 — UI de sync en desktop (NoteMetaBar / Settings)

Nueva sección en SettingsView:

```
Sincronización
─────────────────────────────────────
Servidor:   [ https://trace.midominio.com ]
Estado:     ● Conectado / ✗ Sin conexión
Última sync: hace 2h

[ Push → servidor ]   [ ← Pull del servidor ]

Conflictos pendientes: 2  [ Resolver ]
```

Pantalla de resolución de conflictos:
```
Conflicto en "Introducción al Proyecto Atlas"
────────────────────────────────────────────
Desktop (modificada hace 30 min)    Servidor (modificada hace 2h)
─────────────────────────────────   ──────────────────────────────
[contenido local]                   [contenido servidor]

[ Conservar desktop ]  [ Conservar servidor ]  [ Ver diff ]
```

---

## Bloque C — Experiencia de producto y onboarding
### Prioridad: convertir Trace en algo que usuarios reales instalen

---

### C1 — Guía de instalación para usuarios no técnicos

Crear `docs/getting-started.md` con tres rutas:

**Ruta 1 — Desktop** (2 pasos):
```
1. Descarga el instalador desde GitHub Releases
2. Ábrelo y elige una carpeta para tu bóveda
```

**Ruta 2 — Self-host con Docker** (3 pasos):
```
1. Instala Docker Desktop
2. Descarga docker-compose.yml
3. Ejecuta: docker compose up -d
   Abre: http://localhost:8080
```

**Ruta 3 — Self-host con binario** (para usuarios Linux avanzados):
```
1. Descarga trace-server desde GitHub Releases
2. Ejecuta: ./trace-server --data-dir ./datos --bind 0.0.0.0:8080
3. Abre: http://localhost:8080
```

Incluir capturas de pantalla del setup wizard y del primer uso.

---

### C2 — Windows release en CI

Añadir a `.github/workflows/`:

```yaml
# build-windows.yml
name: Build Windows Desktop
on:
  push:
    tags: ['v*']

jobs:
  build:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run tauri build
      - uses: actions/upload-artifact@v4
        with:
          name: trace-windows-x86_64
          path: |
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*-setup.exe
```

Añadir macOS en paralelo cuando haya runner disponible (requiere firma de
código para distribución fuera de App Store).

---

### C3 — Settings self-host en UI web

Nueva ruta `/settings` en la UI web con secciones:

```
Cuenta
  Email del admin
  Cambiar contraseña

Servidor
  URL pública (TRACE_PUBLIC_URL)
  Versión de trace-server
  Uptime

Seguridad
  Sesiones activas  [ Revocar todas ]
  Últimos 10 eventos del audit log

Datos
  Backup manual  [ Descargar backup ]
  Historial de backups (últimos 5)
  Restore  [ Subir backup ]  ← con confirmación explícita

Danger zone
  Reiniciar setup  [ Requiere confirmación + contraseña ]
```

---

### C4 — Historial de backups con confirmaciones

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS backup_history (
    id          TEXT PRIMARY KEY,
    filename    TEXT NOT NULL,
    size_bytes  INTEGER NOT NULL,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    note        TEXT   -- etiqueta opcional del usuario
);
```

**Flujo de restore mejorado**:
```
1. Usuario sube ZIP de backup
2. Servidor valida: zip-bomb check → trace.db existe → schema válido → tamaño OK
3. Muestra preview: "Este backup tiene X notas, creado el DD/MM/YYYY"
4. Pide confirmación: "Esta acción reemplaza toda la base de datos actual.
   Se perderán los cambios posteriores al backup. ¿Continuar?"
5. Input: escribe RESTORE para confirmar
6. Ejecuta restore
7. Registra en audit_log
```

---

### C5 — SAST y dependency audit en CI

De security-review.md Prioridad 2:

```yaml
# .github/workflows/security.yml
name: Security Audit
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 8 * * 1'  # Lunes 8am

jobs:
  rust-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo install cargo-audit
      - run: cargo audit

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm audit --audit-level=high

  clippy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo clippy --all-targets --all-features -- -D warnings
```

---

## Bloque D — Calidad y tests
### Prioridad: evitar regresiones al crecer

---

### D1 — Tests E2E del frontend web

Usar Playwright (compatible con Vite, sin deps pesadas):

```
tests/e2e/
  auth.spec.ts       → setup, login, logout, sesión expirada
  notes.spec.ts      → CRUD de notas vía UI web
  backup.spec.ts     → backup descarga, restore con confirmación
  sync.spec.ts       → push/pull cuando esté implementado
```

Añadir a CI:
```yaml
- name: E2E tests
  run: |
    cargo run -p trace-server &
    sleep 2
    npx playwright test
```

---

### D2 — Tests de integración HTTP para trace-server

```rust
// crates/trace-server/tests/api_test.rs
#[tokio::test]
async fn test_setup_flow() { ... }

#[tokio::test]
async fn test_login_and_protected_routes() { ... }

#[tokio::test]
async fn test_backup_restore_roundtrip() { ... }

#[tokio::test]
async fn test_setup_returns_404_after_first_use() { ... }

#[tokio::test]
async fn test_rate_limiting_on_login() { ... }
```

---

### D3 — Responsive real del rediseño

El rediseño de UI se hizo en desktop. Revisar breakpoints para:
- Sidebar colapsable en pantallas < 1024px
- Editor a pantalla completa en < 768px
- UI web usable en móvil (al menos lectura y edición básica)

---

## Bloque E — Crecimiento futuro
### No implementar hasta que Bloque A y B estén completos

---

### E1 — Multiusuario con roles (post v0.2)

Schema básico cuando llegue:
```sql
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer';
-- roles: 'admin' | 'editor' | 'viewer'
```

Consideración: el self-host actual es single-user por diseño. Multiusuario
cambia el modelo de datos de vaults significativamente. No añadir hasta tener
usuarios reales que lo pidan.

### E2 — Encriptación del vault (post v0.2)

SQLCipher como extensión de SQLite. Requiere cambio en trace-core y en el
build de Tauri. Alto impacto, evaluar cuando haya demanda.

### E3 — Sync automático con resolución de conflictos (post v0.2)

Solo después de que Modelo B (push/pull explícito) tenga usuarios reales.
La complejidad de CRDTs no está justificada hasta validar el caso de uso
de sync simultáneo.

### E4 — macOS release

Requiere Apple Developer account para firmar. Añadir a CI cuando esté
disponible. La mayor barrera es el signing, no el build.

### E5 — Marketplace de temas

Bajo valor hasta tener base de usuarios. El sistema de dotfiles actual
ya permite compartir temas manualmente.

---

## Resumen ejecutivo: orden de implementación

```
┌─────────────────────────────────────────────────────────────┐
│ BLOQUE A — Fundación estable (hacer antes del release)      │
│                                                             │
│  A1  Unificar UI web con AppShell desktop                   │
│  A2  Refresh tokens + logout + revocación                   │
│  A3  Access token en memoria, no localStorage               │
│  A4  Audit log                                              │
│  A5  Anti-zip-bomb en restore                               │
└─────────────────────────────────────────────────────────────┘
         ↓ (1-2 semanas)
┌─────────────────────────────────────────────────────────────┐
│ BLOQUE B — Push/pull desktop ↔ servidor                     │
│                                                             │
│  B1  Confirmar Modelo B y diseñar API                       │
│  B2  Schema de sync en trace-core                           │
│  B3  Endpoints /api/sync/* en trace-server                  │
│  B4  UI de sync en desktop (Settings + resolver conflictos) │
└─────────────────────────────────────────────────────────────┘
         ↓ (2-3 semanas)
┌─────────────────────────────────────────────────────────────┐
│ BLOQUE C — Experiencia y onboarding                         │
│                                                             │
│  C1  Guía de instalación no técnicos                        │
│  C2  Windows release en CI                                  │
│  C3  Settings self-host en UI web                           │
│  C4  Historial de backups con confirmaciones                │
│  C5  SAST + dependency audit en CI                          │
└─────────────────────────────────────────────────────────────┘
         ↓ (1 semana)
┌─────────────────────────────────────────────────────────────┐
│ BLOQUE D — Calidad                                          │
│                                                             │
│  D1  Tests E2E Playwright del frontend web                  │
│  D2  Tests de integración HTTP de trace-server              │
│      (algunos ya existen, ampliar cobertura)                │
│  D3  Responsive real del rediseño                           │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ BLOQUE E — Crecimiento (no antes)                           │
│  Multiusuario, encriptación, sync automático, macOS, temas  │
└─────────────────────────────────────────────────────────────┘
```

---

## Métricas para saber cuándo está "hecho" cada bloque

**Bloque A completo cuando**:
- `TraceWebApp.tsx` no existe o es un re-export de `AppShell`
- Login en web → refresh token en HttpOnly cookie, access en memoria JS
- Logout revoca el token en SQLite
- Audit log registra los 8 eventos definidos
- `cargo audit` pasa en CI sin warnings altos

**Bloque B completo cuando**:
- Un usuario puede hacer push desde el desktop y ver sus notas en el browser
- Un usuario puede hacer pull desde el desktop y recuperar notas creadas en web
- Los conflictos se muestran en UI y el usuario puede resolverlos manualmente

**Bloque C completo cuando**:
- Un usuario sin conocimientos técnicos puede instalar Trace leyendo la guía
- El instalador Windows se genera en CI en cada tag
- La pantalla de Settings self-host existe en la UI web

**Bloque D completo cuando**:
- `npx playwright test` pasa en CI sin flaky tests
- `cargo test -p trace-server` cubre setup, auth, backup y restore
- La UI web es usable en una pantalla de 768px de ancho
