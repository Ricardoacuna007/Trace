# Trace — Brand Assets

## Archivos incluidos

| Archivo | Uso | Tamaño |
|---------|-----|--------|
| `favicon.svg` | Reemplaza `public/favicon.svg` en el repo | 32×32 |
| `icon-dark.svg` | Ícono standalone sobre fondo oscuro | 64×64 |
| `icon-light.svg` | Ícono standalone sobre fondo claro | 64×64 |
| `icon-transparent.svg` | Ícono sin fondo para cualquier superficie | 64×64 |
| `icon-512.svg` | App bundle, stores, tamaños grandes | 512×512 |
| `logo-dark.svg` | Logo completo para contextos oscuros | 200×56 |
| `logo-light.svg` | Logo completo para contextos claros | 200×56 |
| `logo-readme.svg` | Logo con media query dark/light automático | 200×56 |
| `social-banner.svg` | GitHub social preview / Open Graph | 1280×640 |

---

## Cómo usarlo en el README

### Opción A — automático dark/light con `<picture>`

```html
<picture>
  <source media="(prefers-color-scheme: dark)"  srcset="docs/brand/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/brand/logo-light.svg">
  <img src="docs/brand/logo-light.svg" alt="Trace" height="56">
</picture>
```

### Opción B — SVG con media query interno (un solo archivo)

```md
![Trace](docs/brand/logo-readme.svg)
```

> Nota: GitHub renderiza SVG pero no siempre respeta `prefers-color-scheme`
> en SVGs inline. La Opción A con `<picture>` es más confiable.

---

## Dónde colocar cada archivo en el repo

```
public/
  favicon.svg          ← reemplaza el actual

docs/
  brand/
    icon-dark.svg
    icon-light.svg
    icon-transparent.svg
    icon-512.svg
    logo-dark.svg
    logo-light.svg
    logo-readme.svg
    social-banner.svg
```

Para la social preview de GitHub:
- Ve a Settings → Options → Social Preview
- Exporta `social-banner.svg` a PNG con Inkscape, Figma o un conversor online
- Sube el PNG (GitHub requiere imagen raster para social preview)

---

## Tauri — íconos de la app

Tauri requiere PNG para los iconos del bundle. Convierte `icon-512.svg` a PNG:

```bash
# Con Inkscape
inkscape icon-512.svg --export-png=icon-512.png --export-width=512

# Con rsvg-convert (Linux)
rsvg-convert -w 512 -h 512 icon-512.svg > icon-512.png
```

Luego coloca los PNGs en `src-tauri/icons/` y actualiza `tauri.conf.json`.

---

## Colores del sistema de diseño

| Token | Valor | Uso |
|-------|-------|-----|
| `--accent` | `#5e8bff` | Trazo principal, elemento activo |
| `--accent2` | `#3d6aff` | Hover, variante oscura del accent |
| `--bg` | `#0d0f12` | Fondo principal de la app |

---

## Fuente del wordmark

**DM Sans** weight 300, letter-spacing −0.02em.
Descarga: https://fonts.google.com/specimen/DM+Sans

Si DM Sans no está disponible, el fallback es:
`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
