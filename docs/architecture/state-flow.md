# Trace Store Flow (Slice Pattern)

Este documento describe el flujo actual entre UI, Zustand, adaptador TS y comandos Rust.

## Responsabilidades por slice

- `src/store/slices/createVaultSlice.ts`
  - seleccion de boveda activa
  - carga y guardado de `trace.config.json` y `custom.css`
  - import/export Markdown
  - snapshot de base Markdown
- `src/store/slices/createWorkspaceSlice.ts`
  - CRUD jerarquico (`workspace/folder/note`)
  - seleccion de nodo y `viewMode`
  - relaciones explicitas entre notas
- `src/store/slices/createEditorSlice.ts`
  - patron de borrador unificado (`activeNote`, `draftNote`, `isDirty`)
  - autosave/manual save sobre el borrador
  - commit atomico de nota + tags + relaciones
  - manejo de `saveStatus` y advertencia de cambios pendientes
- `src/store/slices/createGraphSlice.ts`
  - refresco de grafo
  - fallback de modo `rust -> js` segun resultado
- `src/store/slices/createSearchSlice.ts`
  - busqueda global y resultados de paleta
- `src/store/slices/createUISlice.ts`
  - estado visual (sidebar, paneles)
  - modulos persistentes (`ui_modules`)
  - ancho de editor (`full | centered`)
  - autoguardado on/off y preferencias RFC 008

## Flujo de datos (alto nivel)

1. React dispara una accion del store (`useNotesStore`).
2. El slice correspondiente ejecuta la logica y llama a `src/lib/db.ts`.
3. `src/lib/db.ts` invoca comandos Tauri/Rust o `tauri-plugin-sql`.
4. La respuesta vuelve al slice.
5. El slice actualiza estado global (single source of truth).
6. React re-renderiza solo los selectores afectados.

## Reglas de comunicacion cruzada

- Un slice puede coordinarse con otro via `get().otraAccion(...)`.
- Ningun componente de UI habla directo con Rust.
- Toda llamada nativa pasa por `lib/db.ts`.
- Los timers de autosave viven fuera de los componentes para evitar perdida de estado en re-render.
