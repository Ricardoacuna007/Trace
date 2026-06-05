import { create } from 'zustand'
import { DEFAULT_NOTE_TITLE } from '../features/notes-editor/note-utils'
import { EMPTY_GRAPH } from '../features/notes-graph/graph'
import type { Note } from '../types/note'
import type { AppNode } from '../types/workspace'
import type { NotesState } from './types'
import { DEFAULT_TRACE_CONFIG_JSON, CONTENT_AUTOSAVE_DELAY_MS, TITLE_AUTOSAVE_DELAY_MS } from './defaults'
import { normalizeError } from './errors'
import { asNote, canContainChildren, findPreferredParentId, isMoveValid, withTree } from '../lib/workspace'
import { normalizeRelations, toExplicitRelations } from './relations'
import { markSaved } from './saveStatus'
import { createEditorSlice } from './slices/createEditorSlice'
import { createGraphSlice } from './slices/createGraphSlice'
import { createSearchSlice } from './slices/createSearchSlice'
import { createUISlice } from './slices/createUISlice'
import { createVaultSlice } from './slices/createVaultSlice'
import { createWorkspaceSlice } from './slices/createWorkspaceSlice'

const contentSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const titleSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

export const useTraceStore = create<NotesState>()((set, get, api) => ({
  error: null,
  ...createUISlice({
    defaultTraceConfigJson: DEFAULT_TRACE_CONFIG_JSON,
    normalizeError,
  })(set, get, api),
  ...createGraphSlice({
    emptyGraph: EMPTY_GRAPH,
    toExplicitRelations,
  })(set, get, api),
  ...createSearchSlice({
    normalizeError,
  })(set, get, api),
  ...createWorkspaceSlice({
    withTree,
    canContainChildren,
    findPreferredParentId,
    isMoveValid,
    normalizeRelations,
    normalizeError,
    contentSaveTimers,
    titleSaveTimers,
  })(set, get, api),
  ...createEditorSlice({
    withTree,
    normalizeError,
    markSaved,
    defaultNoteTitle: DEFAULT_NOTE_TITLE,
    contentAutosaveDelayMs: CONTENT_AUTOSAVE_DELAY_MS,
    titleAutosaveDelayMs: TITLE_AUTOSAVE_DELAY_MS,
    contentSaveTimers,
    titleSaveTimers,
  })(set, get, api),
  ...createVaultSlice({
    defaultTraceConfigJson: DEFAULT_TRACE_CONFIG_JSON,
    emptyGraph: EMPTY_GRAPH,
    normalizeError,
    normalizeRelations,
    withTree,
  })(set, get, api),
}))

export function useActiveNode(): AppNode | null {
  return useTraceStore((state) => state.nodes.find((node) => node.id === state.selectedNodeId) ?? null)
}

export function useActiveNote(): Note | null {
  return useTraceStore((state) => {
    const selected = state.nodes.find((node) => node.id === state.selectedNodeId)
    return asNote(selected)
  })
}

export function useBreadcrumbPath(): AppNode[] {
  return useTraceStore((state) => {
    if (!state.selectedNodeId) {
      return []
    }

    const byId = new Map(state.nodes.map((node) => [node.id, node]))
    const path: AppNode[] = []
    const visited = new Set<string>()

    let cursor = byId.get(state.selectedNodeId)
    while (cursor && !visited.has(cursor.id)) {
      path.unshift(cursor)
      visited.add(cursor.id)
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    }

    return path
  })
}
