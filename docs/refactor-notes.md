# Refactor Notes

## Consolidacion estructural 2026-06-05

- No quedaron re-exports temporales: los imports directos se actualizaron a las rutas nuevas.
- No se detectaron dependencias circulares al mover helpers de workspace a `src/lib/workspace/`.
- No se detuvo ningun movimiento por requerir cambios de logica.
- `dotfiles/` no se referencia desde `src/` ni desde `src-tauri/src/`; se mantiene como presets estaticos de referencia del repo, no como assets de runtime.
