# Changelog

Todos los cambios notables de Trace se registran aqui.

## 0.1.0 - 2026-06-05

Version inicial de desarrollo publico.

### Agregado

- App desktop Tauri + React para notas local-first.
- Workspace SQLite por boveda local.
- Editor de notas con BlockNote y fallback a texto plano.
- Grafo de notas, backlinks y relaciones explicitas.
- Importacion/exportacion Markdown.
- Personalizacion por boveda con `trace.config.json` y `custom.css`.
- Estructura modular de frontend, hooks y store por slices.
- Workspace Cargo con `trace-core`, `trace-server` y `src-tauri`.
- `trace-core` compartido para schema, modelos, notas y grafo.
- `trace-server` self-host all-in-one con setup, login, API de notas, API de
  grafo, backup/restore y UI web minima.
- Dockerfile y `docker-compose.yml` para self-host.
- Build Linux en GitHub Actions con artefacto `trace-linux-x86_64`.
- CI Docker para construir la imagen y validar `/health`.
- Revision de seguridad documentada en `docs/security-review.md`.

### Pendiente conocido

- Rate limiting para setup/login.
- Refresh tokens y revocacion de sesiones.
- UI web self-host con la misma profundidad visual que el desktop.
- Push/pull desktop-servidor.
- Release publico firmado y probado manualmente en Linux, Windows y macOS.
