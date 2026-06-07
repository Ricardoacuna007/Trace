import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './runtime'
import type {
  TraceConfig,
  TraceLayoutConfig,
  TraceRightPanelMode,
  TraceSidebarPosition,
  TraceUIModules,
  TraceVisibleElements,
  VaultCustomization,
} from './types'

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
  const defaultVisibleElements: TraceVisibleElements = {
    breadcrumb: true,
    metabar: true,
    word_count: true,
    modified_at: true,
    titlebar: true,
    traffic_lights: true,
  }
  const defaultLayout: TraceLayoutConfig = {
    sidebar_position: 'left',
    right_panel: 'visible',
    visible_elements: defaultVisibleElements,
  }

  const fallback: TraceConfig = {
    theme: 'dark',
    accent_color: '#5e8bff',
    font_family: 'DM Sans',
    editor_width: 'centered',
    vim_mode: false,
    layout: defaultLayout,
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
    const rawLayout = config.layout && typeof config.layout === 'object'
      ? config.layout as Record<string, unknown>
      : {}
    const rawVisibleElements = rawLayout.visible_elements && typeof rawLayout.visible_elements === 'object'
      ? rawLayout.visible_elements as Record<string, unknown>
      : {}
    const sidebarPosition = normalizeSidebarPosition(rawLayout.sidebar_position, defaultLayout.sidebar_position)
    const rightPanel = normalizeRightPanel(rawLayout.right_panel, defaultLayout.right_panel)

    return {
      ...fallback,
      ...config,
      theme: config.theme === 'light' ? 'light' : 'dark',
      accent_color: typeof config.accent_color === 'string' ? config.accent_color : fallback.accent_color,
      font_family: typeof config.font_family === 'string' ? config.font_family : fallback.font_family,
      editor_width: editorWidth === 'full' ? 'full' : editorWidth === 'centered' ? 'centered' : editorWidth,
      vim_mode: Boolean(config.vim_mode),
      pinned_note_ids: parseStringArray(config.pinned_note_ids),
      layout: {
        sidebar_position: sidebarPosition,
        right_panel: rightPanel,
        visible_elements: {
          ...defaultVisibleElements,
          breadcrumb: Boolean(rawVisibleElements.breadcrumb ?? defaultVisibleElements.breadcrumb),
          metabar: Boolean(rawVisibleElements.metabar ?? defaultVisibleElements.metabar),
          word_count: Boolean(rawVisibleElements.word_count ?? defaultVisibleElements.word_count),
          modified_at: Boolean(rawVisibleElements.modified_at ?? defaultVisibleElements.modified_at),
          titlebar: Boolean(rawVisibleElements.titlebar ?? defaultVisibleElements.titlebar),
          traffic_lights: Boolean(rawVisibleElements.traffic_lights ?? defaultVisibleElements.traffic_lights),
        },
      },
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

function normalizeSidebarPosition(value: unknown, fallback: TraceSidebarPosition): TraceSidebarPosition {
  return value === 'left' || value === 'right' || value === 'hidden' ? value : fallback
}

function normalizeRightPanel(value: unknown, fallback: TraceRightPanelMode): TraceRightPanelMode {
  return value === 'visible' || value === 'collapsed' || value === 'hidden' ? value : fallback
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
