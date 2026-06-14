# Trace feedback log

Este archivo registra bugs, mejoras y decisiones que vienen de uso real. La regla es simple: si alguien externo lo reporta, entra aqui o en GitHub Issues antes de tocar codigo grande.

## Flujo

1. Registrar el reporte con version, entorno y pasos.
2. Clasificarlo como bug, mejora o decision.
3. Asignar prioridad.
4. Resolverlo o moverlo al roadmap.

## Prioridades

- `P0`: bloquea uso basico o rompe datos.
- `P1`: afecta una tarea comun o confunde a testers.
- `P2`: mejora de calidad, polish o consistencia.
- `P3`: idea futura.

## Reportes activos

### FEEDBACK-001 - Titulos largos no se ven bien

Tipo: bug / UX
Prioridad: P1
Version reportada: v0.2.3
Origen: testers externos
Estado: reabierto y reforzado en rama `codex/v0.3`

Problema:

Cuando una nota tiene un titulo largo, el titulo principal del editor no se ve bien y las superficies compactas lo cortan sin suficiente contexto.

Solucion aceptada:

- Editor principal: permitir wrap visual hasta varias lineas, romper palabras largas y mantener una sola linea logica de texto.
- Sidebar, breadcrumb y paneles compactos: usar ellipsis con tooltip de titulo completo.
- Workspace cards: permitir hasta 2 lineas para que el nombre respire sin romper layout.

### FEEDBACK-002 - Control de bugs y mejoras para siguiente version

Tipo: proceso
Prioridad: P1
Version reportada: v0.2.3
Origen: equipo
Estado: creado

Resultado:

- Se crea este feedback log.
- Se agregan templates de GitHub Issues.
- Se documenta el roadmap v0.3 como referencia de producto.

### FEEDBACK-003 - BlockNote falla en WebView2 instalado manualmente

Tipo: bug / compatibilidad
Prioridad: P0
Version reportada: build manual v0.2.x
Origen: tester externo
Estado: mitigado en v0.2.2, seguimiento abierto

Problema:

En algunos WebView2 de Windows, BlockNote fallo al cargar con `Cannot read properties of undefined (reading 'empty')`.

Solucion aplicada:

- BlockNote, Tiptap y ProseMirror se empaquetan juntos para evitar imports circulares rotos en produccion.
- El editor queda protegido con `ErrorBoundary`.
- Si BlockNote vuelve a fallar, Trace activa modo seguro con textarea para no perder contenido.

Seguimiento:

- Mantener el chunk de BlockNote unido aunque Vite avise por tamano grande.
- Probar build instalado en Windows antes de publicar release final.

### FEEDBACK-004 - Botones de nota sin accion visible

Tipo: bug / UX
Prioridad: P1
Version reportada: v0.2.x
Origen: tester externo
Estado: resuelto en v0.2.3

Problema:

Los botones de compartir y tres puntos estaban visibles, pero no ejecutaban acciones utiles.

Solucion aplicada:

- Compartir copia una referencia interna `[[titulo]]`.
- El menu de tres puntos expone acciones reales: copiar referencia, conectar nota, exportar Markdown, imprimir/PDF, alternar propiedades y abrir comandos.

### FEEDBACK-005 - Self-host web tenia placeholders de conexiones

Tipo: mejora / self-host
Prioridad: P1
Version reportada: v0.3 en desarrollo
Origen: roadmap interno
Estado: resuelto en rama `codex/v0.3`

Problema:

La UI web self-host podia listar/editar notas, pero conectar, desconectar e ignorar sugerencias todavia mostraba mensajes de placeholder.

Solucion aplicada:

- API HTTP para desconectar relaciones bidireccionales.
- API HTTP para listar e ignorar sugerencias.
- Modal web para conectar notas sin depender del store desktop.
- El panel derecho web ya acepta, desconecta e ignora sugerencias.

Seguimiento:

- Import/export Markdown web, carpetas, conexiones y personalizacion visual web ya tienen endpoints/acciones reales en rama `codex/v0.3`.
- La bandeja de entrada web ya puede procesar notas moviendolas a carpetas sugeridas.

### FEEDBACK-006 - Sugerencias inteligentes deben vivir en core

Tipo: arquitectura / calidad de producto
Prioridad: P0
Version reportada: v0.3 en desarrollo
Origen: revision de release
Estado: resuelto en rama `codex/v0.3`

Problema:

Las sugerencias de conexiones eran utiles visualmente, pero no cumplian la promesa de v0.3 si dependian solo de heuristicas del frontend. La feature principal necesitaba calcularse sobre SQLite/FTS5 en Rust para que desktop y self-host compartan la misma logica.

Solucion aplicada:

- `trace-core` expone `suggest_connections(...)` con TF-IDF local sobre el corpus indexado en `nodes_fts`.
- El servidor self-host expone `GET /api/notes/:id/suggestions`.
- Desktop llama el mismo core mediante el comando Tauri `suggest_note_connections`.
- El panel derecho usa la fuente nativa y conserva el algoritmo frontend solo como fallback.

Seguimiento:

- Probar relevancia con vaults reales antes de taggear `v0.3.0`.
- Mantener QA de Windows instalado y Docker real como bloqueo de release.
