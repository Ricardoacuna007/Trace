import { useEffect, useMemo } from 'react'
import { parseTraceConfig } from '../../lib/db'

interface ThemeInjectorProps {
  configJson: string
  customCss: string
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, '')
  if (!/^[\da-f]{6}$/i.test(normalized)) {
    return null
  }

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

function mixRgb(
  color: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
): string {
  const channel = (start: number, end: number) => Math.round(start + (end - start) * amount)
  return `rgb(${channel(color.r, target.r)}, ${channel(color.g, target.g)}, ${channel(color.b, target.b)})`
}

function fontFamilyValue(fontFamily: string): string {
  return fontFamily.includes(',') ? fontFamily : `${fontFamily}, sans-serif`
}

export function ThemeInjector({ configJson, customCss }: ThemeInjectorProps) {
  const config = useMemo(() => parseTraceConfig(configJson), [configJson])

  useEffect(() => {
    const root = document.documentElement
    const widthToken = config.editor_width === 'full'
      ? 'none'
      : config.editor_width === 'centered'
        ? '980px'
        : config.editor_width

    root.dataset.traceTheme = config.theme
    root.dataset.traceEditorWidth = config.editor_width === 'full' ? 'full' : 'centered'
    root.style.setProperty('color-scheme', config.theme)
    root.style.setProperty('--accent', config.accent_color)
    root.style.setProperty('--trace-accent', config.accent_color)

    const accentRgb = hexToRgb(config.accent_color)
    if (accentRgb) {
      root.style.setProperty('--accent2', mixRgb(accentRgb, { r: 0, g: 0, b: 0 }, 0.18))
      root.style.setProperty('--accent-glow', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.13)`)
    }

    const configuredFont = fontFamilyValue(config.font_family)
    root.style.setProperty('--font', configuredFont)
    root.style.setProperty('--trace-font-family', configuredFont)
    root.style.setProperty('--trace-editor-width', widthToken)

    if (config.theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [config.accent_color, config.editor_width, config.font_family, config.theme])

  useEffect(() => {
    const styleId = 'trace-custom-css'
    let styleTag = document.getElementById(styleId) as HTMLStyleElement | null

    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = styleId
      document.head.appendChild(styleTag)
    }

    styleTag.textContent = customCss
  }, [customCss])

  return null
}
