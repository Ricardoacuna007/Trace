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

### FEEDBACK-007 - Gate de QA antes de v0.3.0

Tipo: release / QA
Prioridad: P0
Version reportada: v0.3 en desarrollo
Origen: revision de release
Estado: documentado

Problema:

La version v0.3 agrega features que pasan en desarrollo pero pueden fallar en uso real: sugerencias ruidosas en vaults personales, diferencias de PATH en Windows instalado y self-host Docker validado solo por smoke test.

Decision:

- No taggear `v0.3.0` hasta completar `docs/v0.3-release-qa.md`.
- Usar el auditor `cargo run -p trace-core --example suggestion_audit -- <trace.db> 30 5` para revisar sugerencias con vault real.
- Validar Windows instalado limpio y Docker end-to-end antes de generar release final.
- El workflow Docker debe ejecutar `npm run smoke:self-host`, no solo validar `/health`.

### FEEDBACK-008 - MCP de Trace despues del gate de release

Tipo: arquitectura / integraciones
Prioridad: P2
Version reportada: v0.3 en desarrollo
Origen: discusion de QA
Estado: decidido para post-v0.3

Decision:

Un MCP de Trace seria util para que agentes externos consulten notas, creen capturas o auditen vaults, pero no reemplaza el QA de release. Para cerrar v0.3, las pruebas deben vivir como scripts, tests HTTP y Playwright en CI. El MCP queda como candidato para `v0.3.x` o `v0.4`, cuando la API self-host y los comandos desktop esten estabilizados.

### FEEDBACK-009 - Error ACL al cambiar entre Workspace y Editor

Tipo: bug / desktop
Prioridad: P1
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

Al cambiar varias veces entre Workspace y Editor aparece el error:

```text
Command plugin:window|start_dragging not allowed by ACL.
```

Criterio de resolucion:

- Cambiar entre vistas no debe disparar comandos de drag de ventana fuera de una zona permitida.
- No debe aparecer error visible en consola/UI al alternar `workspace`, `editor` y `graph`.
- Revisar permisos/capabilities de Tauri y el uso de `data-tauri-drag-region` en `TitleBar`.

### FEEDBACK-010 - No se puede renombrar una nota Untitled

Tipo: bug / editor
Prioridad: P1
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

Al renombrar una nota, cuando el usuario borra o llega a la `u` de `Untitled`, el titulo se repone automaticamente. Si selecciona todo y borra, vuelve a aparecer `Untitled`.

Criterio de resolucion:

- El campo de titulo debe permitir quedar temporalmente vacio mientras el usuario edita.
- `Untitled` debe aplicarse solo al confirmar/guardar si el titulo final esta vacio, no en cada tecla.
- Seleccionar todo, borrar y escribir un titulo nuevo debe funcionar sin que el store lo restaure a mitad de edicion.

### FEEDBACK-011 - Accesos laterales sin vista propia

Tipo: bug / UX
Prioridad: P2
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

Los accesos de la barra lateral `Bandeja de entrada`, `Recientes`, `Favoritos` y `Etiquetas` no cambian a una vista especifica; llevan al workspace o se sienten redundantes.

Criterio de resolucion:

- Decidir si esos accesos se eliminan o se implementan como vistas reales.
- Si se conservan, cada acceso debe mostrar una lista filtrada clara.
- El estado activo del sidebar debe reflejar la vista actual.

### FEEDBACK-012 - Apariencia no aplica fuente, texto ni escala global

Tipo: bug / configuracion
Prioridad: P1
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

En Settings > Apariencia, cambiar tamano o fuente no modifica realmente la UI. El fondo cambia, pero el color de texto no. Tambien falta una opcion de escala/zoom global de la aplicacion.

Criterio de resolucion:

- La configuracion de fuente debe afectar editor y UI de la app donde aplique.
- El tamano de texto debe reflejarse en editor y superficies principales.
- El color de texto debe cambiar igual que cambia el fondo.
- Agregar control de escala global de la app, independiente del tamano del editor.
- Persistir cambios en `trace.config.json` o settings equivalentes sin reiniciar.

### FEEDBACK-013 - Settings necesita navegacion por secciones

Tipo: mejora / configuracion
Prioridad: P2
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

Configuracion esta concentrada en una sola vista larga. Se vuelve dificil ubicar Apariencia, Sincronizacion y otras opciones.

Criterio de resolucion:

- Dividir Settings en secciones navegables: Apariencia, Sincronizacion, Datos, Seguridad, Atajos, Avanzado.
- Agregar una seccion de keybindings para ver y eventualmente modificar atajos.
- Mantener densidad visual, sin convertir Settings en landing page.

### FEEDBACK-014 - Barra inferior del grafo tiene informacion poco util

Tipo: mejora / grafo
Prioridad: P2
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

La barra inferior muestra `huerfanas` y `puentes resaltados`, pero esa informacion no aporta lo suficiente en el flujo actual.

Criterio de resolucion:

- Quitar `huerfanas` y `puentes resaltados` de la barra inferior si no son accionables.
- Reemplazar por estados utiles: notas visibles, conexiones visibles, zoom, filtro activo, seleccion actual o estado de layout.
- Mantener texto breve y escaneable.

### FEEDBACK-015 - Renombrar y crear desde el arbol

Tipo: mejora / workspace tree
Prioridad: P1
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

El arbol no permite cambiar el nombre de una carpeta o nota directamente. Tambien falta una forma contextual de agregar elementos desde el arbol.

Criterio de resolucion:

- Doble click en carpeta/nota debe permitir renombrar inline.
- Click derecho debe abrir menu contextual con `Renombrar`, `Nueva nota`, `Nueva carpeta`, `Eliminar` cuando aplique.
- Crear elementos desde una carpeta debe respetar esa carpeta como padre.
- Renombrar debe compartir la misma logica corregida del titulo de nota.

### FEEDBACK-016 - Acciones de crear/configurar estan mal ubicadas

Tipo: mejora / navegacion
Prioridad: P2
Version reportada: v0.3.0
Origen: prueba manual instalada
Estado: abierto

Problema:

Las acciones para crear elementos o entrar a configuracion estan al final de los accesos rapidos del sidebar y se sienten liosas o mezcladas con navegacion.

Criterio de resolucion:

- Separar acciones globales de navegacion.
- Evaluar mover `Nueva nota`, `Nueva carpeta` y `Configuracion` a un header/sidebar action bar o command palette mas clara.
- Evitar que los accesos rapidos parezcan vistas si en realidad son acciones.
