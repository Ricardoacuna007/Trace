import { parseTraceConfig, saveVaultCustomization as saveVaultCustomizationInDb, type TraceUIModules } from '../../lib/db'
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
  nextEditorWidth: 'full' | 'centered',
  nextModules: TraceUIModules,
) {
  const currentState = get()
  const baseConfig = parseTraceConfig(currentState.traceConfigJson || deps.defaultTraceConfigJson)
  const nextConfig = {
    ...baseConfig,
    editor_width: nextEditorWidth,
    ui_modules: nextModules,
  }
  const nextConfigJson = JSON.stringify(nextConfig, null, 2)

  set({
    traceConfigJson: nextConfigJson,
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

    await persistUIConfig(set, get, deps, get().editorWidth, nextModules)
  },
  setEditorWidth: async (width) => {
    const current = get()
    set({ editorWidth: width })
    await persistUIConfig(set, get, deps, width, current.uiModules)
  },
})
