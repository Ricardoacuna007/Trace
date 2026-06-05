# Trace Dotfiles Presets

Presets listos para personalizar `Trace` por boveda.

## Uso rapido

1. Elige un preset (ejemplo `aurora`).
2. Copia:
   - `aurora.trace.config.json` -> `[TU_BOVEDA]/.trace/trace.config.json`
   - `aurora.custom.css` -> `[TU_BOVEDA]/.trace/custom.css`
3. Abre Trace y usa la vista de `Config` para recargar o guardar.

## Presets incluidos

- `default`: balanceado, oscuro limpio, sin efectos agresivos.
- `aurora`: acento cian, paneles con glow suave.
- `nocturne`: oscuro profundo, acento violeta frio.
- `paperlight`: tema claro minimalista para lectura prolongada.
- `focus`: ancho de editor reducido y menos ruido visual.

## Archivos disponibles

- `default.trace.config.json`
- `default.custom.css`
- `aurora.trace.config.json`
- `aurora.custom.css`
- `nocturne.trace.config.json`
- `nocturne.custom.css`
- `paperlight.trace.config.json`
- `paperlight.custom.css`
- `focus.trace.config.json`
- `focus.custom.css`

## Notas

- `trace.config.json` controla variables base (`theme`, `accent_color`, `font_family`, `editor_width`, `vim_mode`).
- `ui_modules` dentro de `trace.config.json` controla visibilidad y comportamiento (`show_breadcrumbs`, `show_backlinks`, `show_node_icons`, `enable_autosave`).
- `custom.css` puede sobreescribir cualquier estilo.
- Si algo se ve raro, vuelve a `default`.
