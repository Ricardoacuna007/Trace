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
Estado: resuelto en v0.2.4

Problema:

Cuando una nota tiene un titulo largo, el titulo principal del editor no se ve bien y las superficies compactas lo cortan sin suficiente contexto.

Solucion aceptada:

- Editor principal: permitir wrap visual hasta 3 lineas y mantener una sola linea logica de texto.
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
