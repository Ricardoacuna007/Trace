# Trace security review

Fecha: 2026-06-06

Este documento evalua la seguridad actual de Trace Desktop y del modo
self-hosted all-in-one. La meta de v0.1 no es competir con una plataforma
multi-tenant, sino entregar una instalacion local-first que sea razonablemente
segura para uso personal, LAN o despliegue detras de un reverse proxy con HTTPS.

## Superficie actual

- `trace-desktop`: app Tauri local-first con SQLite dentro de la boveda local.
- `trace-server`: binario Axum all-in-one con UI web embebida, SQLite en
  `TRACE_DATA_DIR` y API HTTP.
- Docker: un contenedor, un volumen `/data`, un puerto `8080`.
- Auth self-host: setup inicial, login, access token en memoria y refresh token
  en cookie `HttpOnly` para rutas `/api/*`.

## Controles ya implementados

- Setup de admin de un solo uso: `/setup` devuelve `404` cuando ya existe admin.
- Passwords hasheados con Argon2.
- Secreto JWT persistido en SQLite para no invalidar sesiones al reiniciar.
- Middleware JWT en rutas protegidas:
  - `/api/notes`
  - `/api/notes/:id`
  - `/api/relations`
  - `/api/relations/connect`
  - `/api/graph`
  - `/api/backup`
  - `/api/backup/history`
  - `/api/restore`
  - `/api/restore/preview`
  - `/api/sync/*`
  - `/api/admin/audit-log`
- Rate limiting basico en memoria para `/setup` y `/api/auth/login`.
- Refresh tokens persistidos en SQLite, enviados solo por cookie `HttpOnly` con
  `SameSite=Lax`.
- Logout y revocacion global de sesiones invalidan refresh tokens en SQLite.
- Limpieza de refresh tokens expirados al iniciar `trace-server`.
- Audit log de setup, login, logout, backup, restore y fallos relevantes.
- Headers de seguridad en respuestas HTTP:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy`
- Limite global de request body: 256 MiB.
- Restore ZIP valida que exista `trace.db`, valida schema SQLite, limita el
  tamano de DB restaurada y rechaza zip bombs de mas de 10.000 archivos o mas
  de 2 GiB descomprimidos.
- Restore web exige preview y confirmacion escribiendo `RESTORE`.
- Backup fuerza checkpoint WAL antes de empaquetar `trace.db`.
- Historial de backups registrado en SQLite.
- SQLite usa `PRAGMA foreign_keys=ON`, `journal_mode=WAL` y
  `synchronous=NORMAL`.
- CI ejecuta `npm audit`, `cargo audit` y `cargo clippy`.

## Riesgos residuales aceptados para v0.2

- No hay TLS nativo en `trace-server`. Si se expone fuera de localhost/LAN, debe
  ir detras de un reverse proxy con HTTPS.
- Restore reemplaza la DB completa, incluyendo usuarios y secreto JWT. Es
  correcto para backup/restore personal, pero debe comunicarse claramente.
- Los access tokens viven en memoria JS. Esto evita persistencia en storage, pero
  una vulnerabilidad XSS durante la sesion todavia podria abusar del token.
- El rate limiting es en memoria. Reiniciar el proceso limpia contadores.
- `cargo audit` ignora `RUSTSEC-2023-0071`: `rsa` entra al lockfile por soporte
  opcional MySQL de `sqlx` via `tauri-plugin-sql`; Trace habilita solo SQLite.
- No hay modelo de permisos por usuario o por workspace. El self-host actual es
  para un admin/usuario principal.

## Recomendacion de despliegue actual

Para uso local o LAN:

```bash
docker compose up -d
```

Para exponer a internet:

- Usar HTTPS en un reverse proxy.
- Mantener `TRACE_BIND=0.0.0.0:8080` solo dentro del contenedor o red privada.
- No publicar el puerto sin proxy si la red no es confiable.
- Usar password admin largo y unico.
- Hacer backups antes de probar restore.

## Backlog de hardening

Prioridad 0 antes de declarar un release publico:

- Revisar manualmente el draft de release antes de publicarlo.
- Confirmar `Security Audit`, `Build Docker Image` y `Build Linux Desktop`
  verdes en el commit del tag.

Prioridad 1:

- CSRF tokens explicitos si se agregan mutaciones autenticadas basadas solo en
  cookies.
- Exportar audit log como CSV/JSON.
- Checksums opcionales de backups.

Prioridad 2:

- Usuarios multiples con roles.
- Politica configurable de expiracion de sesiones.
- Cifrado de vault con SQLCipher si aparece demanda real.

## Verificacion reciente

Verificado localmente:

- `npm run check`
- `cargo test -p trace-server`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo audit --ignore RUSTSEC-2023-0071`
- `npm run e2e`
- `npm audit --audit-level=high`

Verificado en CI:

- `Build Linux Desktop` con artefacto `trace-linux-x86_64`.
- `Build Docker Image` con smoke test de `/health`.
- `Publish Docker Image` para GHCR en tag `v0.1.0`.

No verificado localmente por limitacion de la maquina:

- Docker runtime local, porque `docker` no esta disponible en esta maquina.
  Queda cubierto por `.github/workflows/docker-image.yml`.
- Smoke test HTTP post-hardening en background, porque PowerShell nego el
  arranque persistente del binario en esta sesion. El flujo HTTP de API,
  backup y restore fue validado antes del hardening; el cambio posterior fue
  compilado y cubierto por el check completo.
