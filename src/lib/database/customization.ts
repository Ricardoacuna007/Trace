import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './runtime'
import type { TraceConfig, TraceUIModules, VaultCustomization } from './types'

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  ))
}

export function parseTraceConfig(configJson: string): TraceConfig {
  const defaultUiModules: TraceUIModules = {
    show_breadcrumbs: true,
    show_backlinks: true,
    show_node_icons: true,
    enable_autosave: true,
  }

  const fallback: TraceConfig = {
    theme: 'dark',
    accent_color: '#5e8bff',
    font_family: 'DM Sans',
    editor_width: 'centered',
    vim_mode: false,
    ui_modules: defaultUiModules,
    pinned_note_ids: [],
  }

  try {
    const parsed = JSON.parse(configJson)
    if (!parsed || typeof parsed !== 'object') {
      return fallback
    }
    const config = parsed as Record<string, unknown>
    const rawUiModules = config.ui_modules
    const uiModulesRecord = (rawUiModules && typeof rawUiModules === 'object')
      ? rawUiModules as Record<string, unknown>
      : {}
    const editorWidth = typeof config.editor_width === 'string'
      ? config.editor_width
      : fallback.editor_width

    return {
      ...fallback,
      ...config,
      theme: config.theme === 'light' ? 'light' : 'dark',
      accent_color: typeof config.accent_color === 'string' ? config.accent_color : fallback.accent_color,
      font_family: typeof config.font_family === 'string' ? config.font_family : fallback.font_family,
      editor_width: editorWidth === 'full' ? 'full' : editorWidth === 'centered' ? 'centered' : editorWidth,
      vim_mode: Boolean(config.vim_mode),
      pinned_note_ids: parseStringArray(config.pinned_note_ids),
      ui_modules: {
        ...defaultUiModules,
        show_breadcrumbs: Boolean(uiModulesRecord.show_breadcrumbs ?? defaultUiModules.show_breadcrumbs),
        show_backlinks: Boolean(uiModulesRecord.show_backlinks ?? defaultUiModules.show_backlinks),
        show_node_icons: Boolean(uiModulesRecord.show_node_icons ?? defaultUiModules.show_node_icons),
        enable_autosave: Boolean(uiModulesRecord.enable_autosave ?? defaultUiModules.enable_autosave),
      },
    }
  } catch {
    return fallback
  }
}

export async function readVaultCustomization(): Promise<VaultCustomization> {
  if (!isTauriRuntime()) {
    return {
      traceDir: '',
      configJson: JSON.stringify(parseTraceConfig('{}'), null, 2),
      customCss: '',
    }
  }

  return invoke<VaultCustomization>('read_vault_customization')
}

export async function saveVaultCustomization(configJson: string, customCss: string): Promise<VaultCustomization> {
  if (!isTauriRuntime()) {
    return {
      traceDir: '',
      configJson,
      customCss,
    }
  }

  return invoke<VaultCustomization>('save_vault_customization', {
    payload: {
      configJson,
      customCss,
    },
  })
}
