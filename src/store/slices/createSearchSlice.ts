import { searchNotesGlobal, type NoteSearchResult } from '../../lib/db'
import type { SliceCreator } from '../types'

interface SearchSliceDeps {
  normalizeError: (error: unknown) => string
}

export const createSearchSlice = (deps: SearchSliceDeps): SliceCreator<{
  commandSearchQuery: string
  commandSearchResults: NoteSearchResult[]
  commandSearchLoading: boolean
  runGlobalSearch: (query: string) => Promise<void>
  clearGlobalSearch: () => void
}> => (set, get) => ({
  commandSearchQuery: '',
  commandSearchResults: [],
  commandSearchLoading: false,
  runGlobalSearch: async (query) => {
    const normalized = query.trim()
    if (normalized.length === 0) {
      set({
        commandSearchQuery: '',
        commandSearchResults: [],
        commandSearchLoading: false,
      })
      return
    }

    set({
      commandSearchQuery: normalized,
      commandSearchLoading: true,
    })

    try {
      const results = await searchNotesGlobal(normalized, 30)
      if (get().commandSearchQuery !== normalized) {
        return
      }
      set({
        commandSearchResults: results,
        commandSearchLoading: false,
      })
    } catch (error) {
      if (get().commandSearchQuery !== normalized) {
        return
      }
      set({
        commandSearchLoading: false,
        commandSearchResults: [],
        error: `No se pudo ejecutar la busqueda global: ${deps.normalizeError(error)}`,
      })
    }
  },
  clearGlobalSearch: () => {
    set({
      commandSearchQuery: '',
      commandSearchResults: [],
      commandSearchLoading: false,
    })
  },
})
