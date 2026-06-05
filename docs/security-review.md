# Trace security review

Fecha: 2026-06-05

Este documento evalua la seguridad actual de Trace Desktop y del modo
self-hosted all-in-one. La meta de v0.1 no es competir con una plataforma
multi-tenant, sino entregar una instalacion local-first que sea razonablemente
segura para uso personal, LAN o despliegue detras de un reverse proxy con HTTPS.

## Superficie actual

- `trace-desktop`: app Tauri local-first con SQLite dentro de la boveda local.
- `trace-server`: binario Axum all-in-one con UI web embebida, SQLite en
  `TRACE_DATA_DIR` y API HTTP.
- Docker: un contenedor, un volumen `/data`, un puerto `8080`.
- Auth self-host: setup inicial, login y JWT Bearer para rutas `/api/*`.

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
  - `/api/restore`
- Rate limiting basico en memoria para `/setup` y `/api/auth/login`.
- Headers de seguridad en respuestas HTTP:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy`
- Limite global de request body: 256 MiB.
- Restore ZIP valida que exista `trace.db`, valida schema SQLite y limita el
  tamano de DB restaurada.
- Backup fuerza checkpoint WAL antes de empaquetar `trace.db`.
- SQLite usa `PRAGMA foreign_keys=ON`, `journal_mode=WAL` y
  `synchronous=NORMAL`.

## Riesgos residuales aceptados para v0.1

- No hay TLS nativo en `trace-server`. Si se expone fuera de localhost/LAN, debe
  ir detras de un reverse proxy con HTTPS.
- El token JWT vive en `localStorage` en el frontend web. La CSP reduce riesgo,
  pero una vulnerabilidad XSS podria robarlo.
- No hay refresh tokens ni revocacion de sesiones.
- Restore reemplaza la DB completa, incluyendo usuarios y secreto JWT. Es
  correcto para backup/restore personal, pero debe comunicarse claramente.
- No hay auditoria de eventos administrativos.
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

- Tests HTTP automatizados para headers de seguridad, auth y restore.
- Guia de reverse proxy con HTTPS.
- Confirmar Docker CI verde con smoke test de `/health`.

Prioridad 1:

- Refresh tokens guardados en SQLite y revocacion por logout.
- Migrar token web a cookie `HttpOnly` + `SameSite=Lax` cuando la UI web este
  lista para CSRF tokens.
- Audit log para login, setup, backup y restore.
- Validacion mas estricta de ZIP restore contra zip bombs.

Prioridad 2:

- Usuarios multiples con roles.
- Politica configurable de expiracion de sesiones.
- Firma o checksum opcional de backups.
- SAST/dependency audit en CI.

## Verificacion reciente

Verificado localmente:

- `npm run check`
- `cargo test -p trace-server`
- `cargo clippy -p trace-server --all-targets -- -D warnings`

No verificado localmente por limitacion de la maquina:

- Docker runtime local, porque `docker` no esta disponible en esta maquina.
  Queda cubierto por `.github/workflows/docker-image.yml`.
- Smoke test HTTP post-hardening en background, porque PowerShell nego el
  arranque persistente del binario en esta sesion. El flujo HTTP de API,
  backup y restore fue validado antes del hardening; el cambio posterior fue
  compilado y cubierto por el check completo.
