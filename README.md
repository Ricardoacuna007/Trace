# Trace

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/brand/logo-light.svg">
  <img src="docs/brand/logo-light.svg" alt="Trace" height="56">
</picture>

Trace es una app de escritorio local-first para notas y conocimiento personal.
Corre sobre Tauri 2 (Rust + WebView) con frontend React.

## Stack

- React 18 + TypeScript 5 + Vite 8
- Tauri 2 (wrapper desktop)
- BlockNote.js (editor por bloques con comando `/`)
- Tailwind CSS (tema oscuro por defecto)
- Zustand (estado global)
- SQLite via `tauri-plugin-sql`
- D3.js para vista de grafo

## Funcionalidades actuales

- Sistema de bovedas locales:
  - seleccion de carpeta local
  - DB en `[boveda]/.trace/trace.db`
- Jerarquia tipo Notion:
  - `workspace -> folder -> note`
- Sidebar recursivo con acciones por nodo
- Editor principal con BlockNote + fallback seguro a textarea
- Titulo dedicado para nota (separado del cuerpo)
- Autosave con debounce (titulo y contenido)
- Estado de borrador unificado (`activeNote` + `draftNote` + `isDirty`)
- Guardado atomico en transaccion SQLite para nota + tags + relaciones
- Vista de grafo de relaciones entre notas
- Relaciones explicitas (`note_relations`) y backlinks
- Busqueda global y paleta de comandos (`Ctrl+K`)
- Personalizacion por boveda:
  - `trace.config.json`
  - `custom.css`
- Interfaz modular (RFC 008):
  - ancho de editor `centered | full`
  - sidebar colapsable (`Ctrl+\`)
  - panel de propiedades y backlinks colapsables
  - toggles persistentes de modulos UI (`ui_modules`)
  - autoguardado configurable + guardado manual (`Ctrl+S`)
- Importacion y exportacion Markdown
- Exportacion PDF via imprimir (`window.print`)

## Requisitos

- Node.js 18+ (recomendado 20+)
- Rust + Cargo (`rustup`)
- Herramientas de compilacion para Tauri en Windows

## Desarrollo

```bash
npm install
npm run tauri dev
```

## Build de produccion

```bash
npm run build
npm run tauri build
```

Artefactos de salida (Windows):

- `src-tauri/target/release/trace.exe`
- `src-tauri/target/release/bundle/msi/Trace_0.2.3_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Trace_0.2.3_x64-setup.exe`

## Self-host all-in-one

La ruta simple para probar Trace en servidor es Docker:

```bash
docker compose up -d
```

Cuando exista un release publicado, tambien se podra usar la imagen GHCR:

```bash
docker run -d --name trace -p 8080:8080 -v trace_data:/data ghcr.io/ricardoacuna007/trace-server:latest
```

Despues abre:

```text
http://localhost:8080
```

En el primer arranque Trace muestra el setup para crear el workspace y el admin.
La API, la UI web y SQLite viven en el mismo contenedor; los datos quedan en el
volumen `trace_data`.

Para correr el binario directamente:

```bash
npm run server:build
TRACE_DATA_DIR=./trace-data TRACE_BIND=127.0.0.1:8080 ./target/release/trace-server
```

## Estructura principal

```text
src/
  app/
    shell/
      AppShell.tsx
      TitleBar.tsx
      Sidebar.tsx
      CommandPalette.tsx
      ThemeInjector.tsx
      VaultSelector.tsx
  features/
    notes-editor/
      BlockNoteEditor.tsx
      contentMetrics.ts
      note-utils.ts
      wikiLinks.ts
    notes-graph/
      graph.ts
    markdown-database/
      MarkdownDatabaseView.tsx
    settings/
      SettingsView.tsx
  hooks/
    useAppHotkeys.ts
    useAppStoreSelection.ts
    useBacklinks.ts
    useCommandSearch.ts
    useSelectedEditorState.ts
    useUnsavedChangesWarning.ts
  lib/
    db.ts
    database/
    workspace/
      nodeTree.ts
      nodeGuards.ts
      noteTransforms.ts
      derived.ts
  store/
    useTraceStore.ts
    types.ts
    slices/
      createVaultSlice.ts
      createWorkspaceSlice.ts
      createEditorSlice.ts
      createGraphSlice.ts
      createSearchSlice.ts
      createUISlice.ts

src-tauri/src/
  commands/
    vault.rs
    graph.rs
    search.rs
    customization.rs
    markdown_io.rs
```

## Modelo de datos

Tabla principal:

- `nodes`
  - `id`
  - `title`
  - `type` (`workspace | folder | note`)
  - `parent_id`
  - `content` (JSON de bloques para notas)
  - `icon`
  - `tags` (JSON string)
  - `position`
  - `updated_at`

Relaciones:

- `note_relations`
  - `source_id`
  - `target_id`

Busqueda:

- FTS5 (`nodes_fts`) para busqueda global rapida

## Boveda y personalizacion

Cada boveda usa carpeta oculta `.trace`:

```text
[TU_BOVEDA]/
  .trace/
    trace.db
    trace.config.json
    custom.css
```

`trace.config.json` ejemplo:

```json
{
  "theme": "dark",
  "accent_color": "#8db4ff",
  "font_family": "Space Grotesk",
  "editor_width": "980px",
  "vim_mode": false
}
```

`custom.css` se inyecta en runtime dentro de `<style id="trace-custom-css">`.

La carpeta `dotfiles/` contiene presets de referencia para `trace.config.json`
y `custom.css`. No se cargan en runtime ni se copian automaticamente en el
bundle; sirven como ejemplos para copiar manualmente a `[TU_BOVEDA]/.trace/`.

## Importar / Exportar

- Importar carpeta Markdown:
  - lee `.md` de forma recursiva
  - soporta frontmatter (`title`, `tags`, `related`)
  - detecta enlaces tipo `[[Nota]]`
- Exportar nota actual a Markdown
- Exportar boveda completa a Markdown
- Exportar nota a PDF usando impresion del WebView

## Atajos de teclado

- `Ctrl+K`: abrir paleta de comandos
- `Ctrl+N`: crear nota
- `Ctrl+\`: mostrar/ocultar sidebar
- `Ctrl+S`: guardar nota en modo manual
- `C`: crear nota en contenedor activo (workspace/folder)

## Notas de arquitectura

- La app intenta calcular grafo en Rust.
- Si falla, hace fallback transparente a calculo JS.
- BlockNote esta protegido con `ErrorBoundary`.
- Si BlockNote falla en WebView2, se activa editor de texto plano para no perder contenido.
- El store usa Slice Pattern de Zustand (Vault, Workspace, Editor, Graph, Search).

Mapa de flujo y responsabilidades:

- `docs/architecture/state-flow.md`

Direccion self-hosted all-in-one:

- `docs/architecture/self-hosted-all-in-one.md`

Seguridad:

- `docs/security-review.md`
- `docs/reverse-proxy.md`

Versionado y releases:

- `CHANGELOG.md`
- `docs/release-process.md`
