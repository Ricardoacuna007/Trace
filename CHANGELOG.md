# Changelog

Todos los cambios notables de Trace se registran aqui.

## 0.2.4 - 2026-06-06

Patch de feedback de testers.

### Agregado

- Roadmap de Trace v0.3 y feedback log para registrar bugs, mejoras y
  decisiones de producto.
- Templates de GitHub Issues para bugs y mejoras.

### Corregido

- Los titulos largos de notas ahora se muestran correctamente en el editor
  principal con wrap visual de hasta 3 lineas.
- Las superficies compactas conservan ellipsis pero muestran el titulo
  completo en tooltip.

## 0.2.3 - 2026-06-06

Patch de interacciones del editor.

### Agregado

- El boton de compartir de la nota copia una referencia interna `[[titulo]]`
  al portapapeles y muestra confirmacion visual.
- El boton de tres puntos abre un menu con acciones reales: copiar referencia,
  conectar nota, exportar Markdown, imprimir/PDF, alternar propiedades y abrir
  comandos.

## 0.2.2 - 2026-06-06

Patch del editor rich text en Windows.

### Corregido

- BlockNote, Tiptap y ProseMirror ahora se empaquetan en un solo chunk de
  produccion para evitar fallos de importacion circular en WebView2 que
  activaban el modo seguro de texto plano.

## 0.2.1 - 2026-06-06

Patch de empaquetado y automatizacion de release.

### Agregado

- El release draft ahora recibe los instaladores Windows `.msi` y `-setup.exe`.
- El release draft ahora recibe `trace-server-linux-x86_64.tar.gz` y su
  checksum SHA-256.
- El workflow Windows se puede ejecutar manualmente desde GitHub Actions.

### Cambiado

- La guia de instalacion Linux explica como extraer y verificar el paquete
  `trace-server-linux-x86_64`.

## 0.2.0 - 2026-06-06

Release de self-host y calidad para dejar Trace listo para probar como app
local-first + servidor all-in-one.

### Agregado

- UI web self-host unificada con el `AppShell` principal.
- Deteccion centralizada de entorno web/Tauri con `EnvProvider`.
- Refresh tokens en SQLite con cookie `HttpOnly` y access token en memoria.
- Logout real, restauracion silenciosa de sesion y revocacion global de
  sesiones.
- Audit log protegido para setup, login, logout, backup y restore.
- Proteccion anti zip-bomb en restore.
- Historial de backups y preview antes de restaurar.
- Sync explicito desktop-servidor con push, pull, estado y conflictos.
- Seccion de sincronizacion en Settings desktop.
- Settings web self-host con cuenta, servidor, seguridad, datos y danger zone.
- Guia de instalacion para Desktop, Docker y binario Linux.
- Tests E2E Playwright para setup/login, notas, backup/restore y sync.
- Tests de integracion HTTP de `trace-server`.
- Workflows de Windows, Linux, Docker, E2E y seguridad.
- Ajustes responsive del shell en 768px y 1024px.

### Cambiado

- La UI web ya no depende de `src/web/TraceWebApp.tsx`.
- El flujo de restore exige confirmacion explicita escribiendo `RESTORE`.
- La revision de seguridad documenta los riesgos residuales de v0.2.

### Pendiente conocido

- Publicar el release solo despues de revisar los artefactos generados por CI.
- Firma de instaladores Windows/macOS.
- Multiusuario con roles y cifrado de vault quedan para crecimiento futuro.

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

- Release publico firmado y probado manualmente en Linux, Windows y macOS.
