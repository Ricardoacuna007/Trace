import {
  parseTraceConfig,
  saveVaultCustomization as saveVaultCustomizationInDb,
  type TraceConfig,
  type TraceLayoutConfig,
  type TraceUIModules,
} from '../../lib/db'
import type { NotesState, SliceCreator, UISlice } from '../types'

interface UISliceDeps {
  defaultTraceConfigJson: string
  normalizeError: (error: unknown) => string
}

function toEditorWidthMode(value: string): 'full' | 'centered' {
  return value === 'full' ? 'full' : 'centered'
}

async function persistUIConfig(
  set: (partial: Partial<NotesState>) => void,
  get: () => NotesState,
  deps: UISliceDeps,
  updater: (config: TraceConfig) => TraceConfig,
) {
  const currentState = get()
  const baseConfig = parseTraceConfig(currentState.traceConfigJson || deps.defaultTraceConfigJson)
  const nextConfig = updater(baseConfig)
  const nextConfigJson = JSON.stringify(nextConfig, null, 2)

  set({
    traceConfigJson: nextConfigJson,
    traceTheme: nextConfig.theme,
    traceAccentColor: nextConfig.accent_color,
    traceFontFamily: nextConfig.font_family,
    traceEditorSettings: nextConfig.editor,
    traceGraphSettings: nextConfig.graph,
    traceLayout: nextConfig.layout,
    editorWidth: toEditorWidthMode(nextConfig.editor_width),
    uiModules: nextConfig.ui_modules,
  })

  if (currentState.vaultRequired || !currentState.activeVaultPath) {
    return
  }

  try {
    const customization = await saveVaultCustomizationInDb(nextConfigJson, currentState.customCss)
    set({
      traceDir: customization.traceDir || null,
      traceConfigJson: customization.configJson || nextConfigJson,
      customCss: customization.customCss ?? currentState.customCss,
      error: null,
    })
  } catch (error) {
    set({
      error: `No se pudo persistir configuracion UI: ${deps.normalizeError(error)}`,
    })
  }
}

export const createUISlice = (deps: UISliceDeps): SliceCreator<UISlice> => (set, get) => ({
  traceTheme: 'dark',
  traceAccentColor: '#5e8bff',
  traceFontFamily: 'DM Sans',
  traceEditorSettings: parseTraceConfig(deps.defaultTraceConfigJson).editor,
  traceGraphSettings: parseTraceConfig(deps.defaultTraceConfigJson).graph,
  traceLayout: parseTraceConfig(deps.defaultTraceConfigJson).layout,
  editorWidth: 'centered',
  isSidebarOpen: true,
  isPropertiesPanelOpen: true,
  isBacklinksPanelOpen: true,
  isConnectModalOpen: false,
  uiModules: {
    show_breadcrumbs: true,
    show_backlinks: true,
    show_node_icons: true,
    enable_autosave: true,
  },
  hydrateUIFromConfig: (configJson) => {
    const parsed = parseTraceConfig(configJson || deps.defaultTraceConfigJson)
    set((state) => ({
      traceTheme: parsed.theme,
      traceAccentColor: parsed.accent_color,
      traceFontFamily: parsed.font_family,
      traceEditorSettings: parsed.editor,
      traceGraphSettings: parsed.graph,
      traceLayout: parsed.layout,
      editorWidth: toEditorWidthMode(parsed.editor_width),
      pinnedNoteIds: parsed.pinned_note_ids,
      uiModules: parsed.ui_modules,
      isBacklinksPanelOpen: parsed.ui_modules.show_backlinks ? state.isBacklinksPanelOpen : false,
    }))
  },
  toggleSidebar: () => {
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen }))
  },
  togglePropertiesPanel: () => {
    set((state) => ({ isPropertiesPanelOpen: !state.isPropertiesPanelOpen }))
  },
  toggleBacklinksPanel: () => {
    set((state) => ({ isBacklinksPanelOpen: !state.isBacklinksPanelOpen }))
  },
  openConnectModal: () => {
    set({ isConnectModalOpen: true })
  },
  closeConnectModal: () => {
    set({ isConnectModalOpen: false })
  },
  updateTraceAppearance: async (patch) => {
    await persistUIConfig(set, get, deps, (config) => ({
      ...config,
      theme: patch.theme ?? config.theme,
      accent_color: patch.accent_color ?? config.accent_color,
      font_family: patch.font_family ?? config.font_family,
    }))
  },
  updateTraceEditorSettings: async (patch) => {
    await persistUIConfig(set, get, deps, (config) => ({
      ...config,
      editor: {
        ...config.editor,
        ...patch,
      },
    }))
  },
  updateTraceGraphSettings: async (patch) => {
    await persistUIConfig(set, get, deps, (config) => ({
      ...config,
      graph: {
        ...config.graph,
        ...patch,
      },
    }))
  },
  updateTraceLayout: async (layout) => {
    const normalizedLayout: TraceLayoutConfig = {
      ...layout,
      visible_elements: {
        ...layout.visible_elements,
      },
    }
    set({
      traceLayout: normalizedLayout,
      isPropertiesPanelOpen: normalizedLayout.right_panel === 'visible',
    })
    await persistUIConfig(set, get, deps, (config) => ({
      ...config,
      layout: normalizedLayout,
    }))
  },
  updateUIModule: async (module, value) => {
    const current = get()
    const nextModules: TraceUIModules = {
      ...current.uiModules,
      [module]: value,
    }

    set((state) => ({
      uiModules: nextModules,
      isBacklinksPanelOpen: module === 'show_backlinks'
        ? (value ? state.isBacklinksPanelOpen : false)
        : state.isBacklinksPanelOpen,
    }))

    await persistUIConfig(set, get, deps, (config) => ({
      ...config,
      editor_width: get().editorWidth,
      ui_modules: nextModules,
    }))
  },
  setEditorWidth: async (width) => {
    const current = get()
    set({ editorWidth: width })
    await persistUIConfig(set, get, deps, (config) => ({
      ...config,
      editor_width: width,
      ui_modules: current.uiModules,
    }))
  },
})
