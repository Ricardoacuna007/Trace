# Trace Self-Hosted All-in-One

Este documento define la direccion tecnica para que Trace pueda ser local-first y
self-hosted sin convertir la instalacion en una coreografia de servicios.

## Objetivo de producto

Una persona debe poder hostear Trace con una de estas dos rutas:

```bash
docker compose up -d
```

o:

```bash
trace-server --data-dir ./trace-data --bind 0.0.0.0:8080
```

El primer arranque debe abrir un asistente web para crear el usuario admin. No
debe requerir Postgres, Redis, Nginx, workers separados ni edicion manual de diez
variables de entorno.

## Modelo recomendado

Trace queda dividido en dos productos compatibles:

- `trace-desktop`: app Tauri actual. Trabaja offline con SQLite local.
- `trace-server`: servicio opcional all-in-one para web, sync, backups y acceso
  remoto.

El servidor debe incluir:

- UI web estatica servida por el mismo binario.
- API HTTP para auth, vaults, sync y backups.
- WebSocket o SSE para eventos de sync.
- SQLite embebido en un volumen unico.
- Migraciones automaticas al iniciar.
- Setup wizard cuando no exista usuario admin.
- Export/import de datos para no encerrar al usuario.

## Shape de deploy

Ejemplo objetivo:

```yaml
services:
  trace:
    image: trace/trace-server:latest
    ports:
      - "8080:8080"
    volumes:
      - trace_data:/data
    environment:
      TRACE_PUBLIC_URL: "http://localhost:8080"

volumes:
  trace_data:
```

`TRACE_PUBLIC_URL` debe ser opcional en LAN/local, pero util cuando el usuario
quiera poner Trace detras de un proxy con HTTPS.

## Stack sugerido para `trace-server`

- Rust + Axum para API y servidor web.
- SQLite para almacenamiento embebido.
- `tower-http` para servir assets y middleware.
- WebSocket/SSE para eventos.
- Argon2 o equivalente para passwords.
- Tokens de sesion HTTP-only.

Mantener Rust en el servidor evita partir la base en demasiados lenguajes y
permite compartir tipos, migraciones y logica de import/export con Tauri.

## Principios

- Local-first: el desktop no depende del servidor para funcionar.
- Server-optional: el servidor agrega sync, web y backup, no toma control total.
- One container: ninguna dependencia externa obligatoria.
- Escape hatch: exportacion Markdown/JSON y backups legibles.
- Small admin surface: setup inicial, usuarios, vaults, backup, restore y estado
  de sync.

## Roadmap de implementacion

1. Extraer un paquete Rust compartido para modelo, migraciones y utilidades de
   vault.
2. Crear `trace-server` como binario separado con SQLite en `/data/trace.db`.
3. Servir una UI web minima desde el mismo binario.
4. Agregar auth local y setup wizard.
5. Implementar backup/restore de vault.
6. Agregar sync basico desktop-servidor.
7. Evaluar CRDT solo cuando haya colaboracion simultanea real.

## Decision actual

No se recomienda migrar el desktop a Flutter ni a una UI nativa pura. El stack
actual de Tauri + React + SQLite sigue siendo adecuado para una app ligera,
rapida de iterar y local-first. El self-hosted debe crecer como una capa
opcional all-in-one, no como reemplazo del cliente local.

## Estado de implementacion

Implementado:

- Workspace Cargo en la raiz con `crates/trace-core`, `crates/trace-server` y
  `src-tauri`.
- `trace-core` contiene el schema SQLite compartido, tipos base de modelos,
  configuracion de vault y claims JWT.
- `src-tauri` consume `trace-core::schema`, evitando duplicar migraciones.
- `trace-server` arranca como binario all-in-one con:
  - `GET /health`
  - `GET /`
  - `GET /setup`
  - `POST /setup`
  - `GET /api/setup/status`
  - `POST /api/auth/login`
  - SQLite en `--data-dir` / `TRACE_DATA_DIR`
  - migraciones automaticas al iniciar
  - usuario admin inicial
  - JWT firmado con secreto persistido en SQLite
- `Dockerfile` y `docker-compose.yml` para `docker compose up -d`.

Pendiente:

- Middleware JWT para proteger rutas `/api`.
- API HTTP completa de notas y grafo.
- Backup/restore ZIP.
- UI web real conectada a la API.
- Push/pull desktop-servidor. Para v1 se mantiene la recomendacion de Modelo B:
  vaults independientes con operaciones explicitas antes de sync automatico.
