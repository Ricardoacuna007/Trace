import {
  exportCurrentNoteMarkdown,
  exportVaultMarkdown,
  getActiveVault,
  importMarkdownDirectory,
  readVaultCustomization,
  saveVaultCustomization as saveVaultCustomizationInDb,
  scanMarkdownDatabase,
  setActiveVault,
  updateMarkdownFrontmatterProperty,
} from '../../lib/db'
import type { SliceCreator, VaultSlice } from '../types'
import { createEmptyVaultState, hydrateVaultState, type VaultSliceDeps } from './vaultHydration'

export const createVaultSlice = (deps: VaultSliceDeps): SliceCreator<VaultSlice> => (set, get) => ({
  traceDir: null,
  traceConfigJson: deps.defaultTraceConfigJson,
  customCss: '',
  customizationLoading: false,
  customizationSaving: false,
  ioWorking: false,
  ioMessage: null,
  markdownDbLoading: false,
  markdownDbSnapshot: null,
  activeVaultPath: null,
  vaultRequired: false,
  loading: true,
  initialized: false,
  initialize: async () => {
    if (get().initialized) {
      return
    }

    set({ loading: true, error: null })

    try {
      const activeVault = await getActiveVault()
      if (!activeVault) {
        set(createEmptyVaultState(deps))
        get().hydrateUIFromConfig(deps.defaultTraceConfigJson)
        return
      }

      await hydrateVaultState(set, get, activeVault.vaultPath, deps)
    } catch (error) {
      set({
        loading: false,
        initialized: true,
        vaultRequired: true,
        error: `No se pudo abrir la base local: ${deps.normalizeError(error)}`,
      })
    }
  },
  selectVaultPath: async (vaultPath) => {
    set({ loading: true, error: null })
    try {
      const activeVault = await setActiveVault(vaultPath)
      await hydrateVaultState(set, get, activeVault.vaultPath, deps)
    } catch (error) {
      set({
        loading: false,
        error: `No se pudo abrir la boveda: ${deps.normalizeError(error)}`,
      })
    }
  },
  loadVaultCustomization: async () => {
    const current = get()
    if (current.vaultRequired || !current.activeVaultPath) {
      return
    }

    set({ customizationLoading: true, error: null })
    try {
      const customization = await readVaultCustomization()
      set({
        traceDir: customization.traceDir || null,
        traceConfigJson: customization.configJson || deps.defaultTraceConfigJson,
        customCss: customization.customCss ?? '',
        customizationLoading: false,
      })
      get().hydrateUIFromConfig(customization.configJson || deps.defaultTraceConfigJson)
    } catch (error) {
      set({
        customizationLoading: false,
        error: `No se pudo cargar la configuracion de la boveda: ${deps.normalizeError(error)}`,
      })
    }
  },
  saveVaultCustomization: async (configJson, customCss, options) => {
    const current = get()
    if (current.vaultRequired || !current.activeVaultPath) {
      return
    }

    set({
      customizationSaving: options?.silent ? get().customizationSaving : true,
      ioMessage: options?.silent ? get().ioMessage : null,
      error: null,
    })
    try {
      const customization = await saveVaultCustomizationInDb(configJson, customCss)
      set({
        traceDir: customization.traceDir || null,
        traceConfigJson: customization.configJson || deps.defaultTraceConfigJson,
        customCss: customization.customCss ?? '',
        customizationSaving: options?.silent ? get().customizationSaving : false,
        ioMessage: options?.silent ? get().ioMessage : 'Configuracion guardada en la boveda.',
      })
      get().hydrateUIFromConfig(customization.configJson || deps.defaultTraceConfigJson)
    } catch (error) {
      set({
        customizationSaving: options?.silent ? get().customizationSaving : false,
        error: `No se pudo guardar la configuracion: ${deps.normalizeError(error)}`,
      })
    }
  },
  importMarkdownFromDir: async (sourceDir) => {
    const current = get()
    if (current.vaultRequired || !current.activeVaultPath) {
      return null
    }

    set({
      ioWorking: true,
      ioMessage: null,
      error: null,
    })

    try {
      const summary = await importMarkdownDirectory(sourceDir)
      const activeVaultPath = get().activeVaultPath
      if (activeVaultPath) {
        await hydrateVaultState(set, get, activeVaultPath, deps)
      }
      set({
        ioWorking: false,
        ioMessage: `Importacion completada: ${summary.importedNotes} notas y ${summary.createdRelations} relaciones.`,
      })
      return summary
    } catch (error) {
      set({
        ioWorking: false,
        error: `No se pudo importar Markdown: ${deps.normalizeError(error)}`,
      })
      return null
    }
  },
  exportCurrentNoteToMarkdown: async (noteId, outputDir) => {
    const current = get()
    if (current.vaultRequired || !current.activeVaultPath) {
      return null
    }

    set({
      ioWorking: true,
      ioMessage: null,
      error: null,
    })

    try {
      const outputPath = await exportCurrentNoteMarkdown(noteId, outputDir)
      set({
        ioWorking: false,
        ioMessage: `Nota exportada a: ${outputPath}`,
      })
      return outputPath
    } catch (error) {
      set({
        ioWorking: false,
        error: `No se pudo exportar la nota: ${deps.normalizeError(error)}`,
      })
      return null
    }
  },
  exportVaultToMarkdown: async (outputDir) => {
    const current = get()
    if (current.vaultRequired || !current.activeVaultPath) {
      return null
    }

    set({
      ioWorking: true,
      ioMessage: null,
      error: null,
    })

    try {
      const exportedCount = await exportVaultMarkdown(outputDir)
      set({
        ioWorking: false,
        ioMessage: `Exportacion completada: ${exportedCount} notas.`,
      })
      return exportedCount
    } catch (error) {
      set({
        ioWorking: false,
        error: `No se pudo exportar la boveda: ${deps.normalizeError(error)}`,
      })
      return null
    }
  },
  refreshMarkdownDatabase: async () => {
    const current = get()
    if (current.vaultRequired || !current.activeVaultPath) {
      return
    }

    set({
      markdownDbLoading: true,
      error: null,
    })

    try {
      const snapshot = await scanMarkdownDatabase()
      set({
        markdownDbSnapshot: snapshot,
        markdownDbLoading: false,
      })
    } catch (error) {
      set({
        markdownDbLoading: false,
        error: `No se pudo refrescar la base Markdown: ${deps.normalizeError(error)}`,
      })
    }
  },
  updateMarkdownDatabaseProperty: async (filePath, key, value) => {
    const current = get()
    if (current.vaultRequired || !current.activeVaultPath) {
      return
    }

    set({
      markdownDbLoading: true,
      error: null,
    })

    try {
      await updateMarkdownFrontmatterProperty(filePath, key, value)
      const reloaded = await scanMarkdownDatabase()
      set({
        markdownDbSnapshot: reloaded,
        markdownDbLoading: false,
      })
    } catch (error) {
      set({
        markdownDbLoading: false,
        error: `No se pudo actualizar propiedad Markdown: ${deps.normalizeError(error)}`,
      })
    }
  },
  clearIoMessage: () => {
    set({ ioMessage: null })
  },
})
