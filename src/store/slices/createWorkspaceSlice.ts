import {
  addNoteRelation,
  changeNodeIcon as changeNodeIconInDb,
  createInboxNote as createInboxNoteInDb,
  createNode,
  deleteNode,
  ignoreConnectionSuggestion as ignoreConnectionSuggestionInDb,
  listIgnoredSuggestions,
  listNodes,
  listNoteRelations,
  moveNode as moveNodeInDb,
  parseTraceConfig,
  removeNoteRelation,
  renameNode as renameNodeInDb,
  saveVaultCustomization as saveVaultCustomizationInDb,
} from '../../lib/db'
import { notesFromNodes, activeViewFromMode } from '../../lib/workspace'
import type { AppNode, TreeNode } from '../../types/workspace'
import type { AppViewMode, NoteRelation, NotesState, SliceCreator, ViewMode } from '../types'

interface WorkspaceSliceDeps {
  withTree: (nodes: AppNode[]) => { nodes: AppNode[]; nodeTree: TreeNode[] }
  canContainChildren: (nodeType: AppNode['type']) => boolean
  findPreferredParentId: (state: NotesState, explicitParentId?: string | null) => string | null
  isMoveValid: (nodes: AppNode[], nodeId: string, newParentId: string | null) => { ok: boolean; reason?: string }
  normalizeRelations: (rows: Array<{ source_id: string; target_id: string }>) => NoteRelation[]
  normalizeError: (error: unknown) => string
  contentSaveTimers: Map<string, ReturnType<typeof setTimeout>>
  titleSaveTimers: Map<string, ReturnType<typeof setTimeout>>
}

async function persistPinnedNotes(
  set: (partial: Partial<NotesState>) => void,
  get: () => NotesState,
  deps: WorkspaceSliceDeps,
  pinnedNoteIds: string[],
) {
  const currentState = get()
  const nextConfig = {
    ...parseTraceConfig(currentState.traceConfigJson || '{}'),
    pinned_note_ids: pinnedNoteIds,
  }
  const nextConfigJson = JSON.stringify(nextConfig, null, 2)

  set({ traceConfigJson: nextConfigJson })

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
      error: `No se pudieron persistir favoritos: ${deps.normalizeError(error)}`,
    })
  }
}

export const createWorkspaceSlice = (deps: WorkspaceSliceDeps): SliceCreator<{
  workspaceSystemEnabled: boolean
  nodes: AppNode[]
  notes: NotesState['notes']
  nodeTree: TreeNode[]
  noteRelations: NoteRelation[]
  connections: NoteRelation[]
  ignoredSuggestionPairs: string[]
  selectedNodeId: string | null
  activeNoteId: string | null
  activeView: AppViewMode
  viewMode: ViewMode
  pinnedNoteIds: string[]
  recentConnectionIds: string[]
  createWorkspace: () => Promise<void>
  createFolder: (parentId?: string | null) => Promise<void>
  createNewNote: (parentId?: string | null) => Promise<void>
  createInboxNote: (content: string) => Promise<string | null>
  createNoteFromTitle: (title: string, parentId?: string | null) => Promise<string | null>
  loadNotes: () => Promise<void>
  deleteNodeById: (id: string) => Promise<void>
  renameNodeById: (id: string, title: string) => Promise<void>
  changeNodeIconById: (id: string, icon: string) => Promise<void>
  moveNodeById: (id: string, newParentId: string | null) => Promise<void>
  addRelationByIds: (sourceId: string, targetId: string) => Promise<void>
  removeRelationByIds: (sourceId: string, targetId: string) => Promise<void>
  connectNotes: (sourceId: string, targetIds: string[]) => Promise<void>
  ignoreConnectionSuggestion: (sourceId: string, targetId: string) => Promise<void>
  getBacklinks: (noteId: string) => NotesState['notes']
  pinNote: (noteId: string) => void
  unpinNote: (noteId: string) => void
  selectNode: (id: string) => void
  setActiveNote: (id: string | null) => void
  setActiveView: (view: AppViewMode) => void
  setViewMode: (mode: ViewMode) => void
}> => (set, get) => ({
  workspaceSystemEnabled: true,
  nodes: [],
  notes: [],
  nodeTree: [],
  noteRelations: [],
  connections: [],
  ignoredSuggestionPairs: [],
  selectedNodeId: null,
  activeNoteId: null,
  activeView: 'workspace',
  viewMode: 'editor',
  pinnedNoteIds: [],
  recentConnectionIds: [],
  createWorkspace: async () => {
    try {
      const node = await createNode({ type: 'workspace', title: 'Workspace', icon: 'workspace' })
      const nextNodes = [...get().nodes, node]
      const treeState = deps.withTree(nextNodes)

      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        selectedNodeId: node.id,
        activeNoteId: null,
        activeView: 'workspace',
        viewMode: 'editor',
      })

      await get().refreshGraph(treeState.nodes)
    } catch (error) {
      set({ error: `No se pudo crear el workspace: ${deps.normalizeError(error)}` })
    }
  },
  createFolder: async (parentId) => {
    try {
      const targetParent = deps.findPreferredParentId(get(), parentId)
      if (!targetParent) {
        set({ error: 'Selecciona un workspace o carpeta para crear la carpeta.' })
        return
      }

      const parentNode = get().nodes.find((node) => node.id === targetParent)
      if (!parentNode || !deps.canContainChildren(parentNode.type)) {
        set({ error: 'La carpeta solo puede crearse dentro de un workspace o carpeta.' })
        return
      }

      const node = await createNode({ type: 'folder', parentId: targetParent, title: 'Nueva carpeta', icon: 'folder' })
      const nextNodes = [...get().nodes, node]
      const treeState = deps.withTree(nextNodes)

      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        selectedNodeId: node.id,
        activeNoteId: null,
        activeView: 'workspace',
        viewMode: 'editor',
      })
    } catch (error) {
      set({ error: `No se pudo crear la carpeta: ${deps.normalizeError(error)}` })
    }
  },
  createNewNote: async (parentId) => {
    try {
      const targetParent = deps.findPreferredParentId(get(), parentId)
      if (!targetParent) {
        set({ error: 'Selecciona un workspace o carpeta para crear la nota.' })
        return
      }

      const parentNode = get().nodes.find((node) => node.id === targetParent)
      if (!parentNode || !deps.canContainChildren(parentNode.type)) {
        set({ error: 'La nota solo puede crearse dentro de un workspace o carpeta.' })
        return
      }

      const node = await createNode({ type: 'note', parentId: targetParent, title: 'Untitled', content: '[]', icon: 'note', tags: [] })
      const nextNodes = [...get().nodes, node]
      const treeState = deps.withTree(nextNodes)

      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        selectedNodeId: node.id,
        activeNoteId: node.id,
        activeView: 'editor',
        viewMode: 'editor',
      })

      await get().refreshGraph(treeState.nodes)
    } catch (error) {
      set({ error: `No se pudo crear la nota: ${deps.normalizeError(error)}` })
    }
  },
  createInboxNote: async (content) => {
    const normalizedContent = content.trim()
    if (!normalizedContent) {
      set({ error: 'Escribe algo para capturar una nota.' })
      return null
    }

    try {
      const node = await createInboxNoteInDb(normalizedContent)
      const nextNodes = [node, ...get().nodes]
      const treeState = deps.withTree(nextNodes)

      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        selectedNodeId: node.id,
        activeNoteId: node.id,
        activeView: 'editor',
        viewMode: 'editor',
        saveStatus: 'idle',
        error: null,
      })

      await get().refreshGraph(treeState.nodes)
      return node.id
    } catch (error) {
      set({ error: `No se pudo capturar la nota: ${deps.normalizeError(error)}` })
      return null
    }
  },
  createNoteFromTitle: async (title, parentId) => {
    try {
      const targetParent = deps.findPreferredParentId(get(), parentId)
      if (!targetParent) {
        set({ error: 'Selecciona un workspace o carpeta para crear la nota.' })
        return null
      }

      const parentNode = get().nodes.find((node) => node.id === targetParent)
      if (!parentNode || !deps.canContainChildren(parentNode.type)) {
        set({ error: 'La nota solo puede crearse dentro de un workspace o carpeta.' })
        return null
      }

      const node = await createNode({
        type: 'note',
        parentId: targetParent,
        title: title.trim() || 'Untitled',
        content: '[]',
        icon: 'note',
        tags: [],
      })
      const nextNodes = [...get().nodes, node]
      const treeState = deps.withTree(nextNodes)

      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        selectedNodeId: node.id,
        activeNoteId: node.id,
        activeView: 'editor',
        viewMode: 'editor',
        saveStatus: 'idle',
        error: null,
      })

      await get().refreshGraph(treeState.nodes)
      return node.id
    } catch (error) {
      set({ error: `No se pudo crear la nota: ${deps.normalizeError(error)}` })
      return null
    }
  },
  loadNotes: async () => {
    try {
      const nodes = await listNodes()
      const relationRows = await listNoteRelations()
      const ignoredRows = await listIgnoredSuggestions()
      const noteRelations = deps.normalizeRelations(relationRows)
      const treeState = deps.withTree(nodes)
      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        noteRelations,
        connections: noteRelations,
        ignoredSuggestionPairs: ignoredRows.map((row) => `${row.source_id}->${row.target_id}`),
      })
      await get().refreshGraph(treeState.nodes, noteRelations)
    } catch (error) {
      set({ error: `No se pudieron cargar las notas: ${deps.normalizeError(error)}` })
    }
  },
  deleteNodeById: async (id) => {
    try {
      const pendingContentSave = deps.contentSaveTimers.get(id)
      if (pendingContentSave) {
        clearTimeout(pendingContentSave)
        deps.contentSaveTimers.delete(id)
      }
      const pendingTitleSave = deps.titleSaveTimers.get(id)
      if (pendingTitleSave) {
        clearTimeout(pendingTitleSave)
        deps.titleSaveTimers.delete(id)
      }

      await deleteNode(id)

      const nodes = await listNodes()
      const relationRows = await listNoteRelations()
      const noteRelations = deps.normalizeRelations(relationRows)
      const treeState = deps.withTree(nodes)
      const hasSelected = treeState.nodes.some((node) => node.id === get().selectedNodeId)
      const fallbackSelection = treeState.nodes.find((node) => node.type === 'workspace')
        ?? treeState.nodes[0]
        ?? null
      const existingNodeIds = new Set(treeState.nodes.map((node) => node.id))
      const currentPinnedNoteIds = get().pinnedNoteIds
      const nextPinnedNoteIds = currentPinnedNoteIds.filter((noteId) => existingNodeIds.has(noteId))

      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        noteRelations,
        connections: noteRelations,
        selectedNodeId: hasSelected ? get().selectedNodeId : fallbackSelection?.id ?? null,
        activeNoteId: hasSelected ? get().activeNoteId : null,
        pinnedNoteIds: nextPinnedNoteIds,
        saveStatus: 'idle',
      })

      if (nextPinnedNoteIds.length !== currentPinnedNoteIds.length) {
        void persistPinnedNotes(set, get, deps, nextPinnedNoteIds)
      }

      await get().refreshGraph(treeState.nodes, noteRelations)
    } catch (error) {
      set({ error: `No se pudo eliminar el nodo: ${deps.normalizeError(error)}` })
    }
  },
  renameNodeById: async (id, title) => {
    try {
      const { updatedAt } = await renameNodeInDb(id, title)
      const nextNodes = get().nodes.map((node) => (
        node.id === id
          ? { ...node, title: title.trim() || node.title, updatedAt }
          : node
      ))
      const treeState = deps.withTree(nextNodes)
      set({ ...treeState, notes: notesFromNodes(treeState.nodes) })

      await get().refreshGraph(treeState.nodes)
    } catch (error) {
      set({ error: `No se pudo renombrar: ${deps.normalizeError(error)}` })
    }
  },
  changeNodeIconById: async (id, icon) => {
    try {
      const trimmed = icon.trim()
      const { updatedAt } = await changeNodeIconInDb(id, trimmed || null)
      const nextNodes = get().nodes.map((node) => (
        node.id === id
          ? { ...node, icon: trimmed || undefined, updatedAt }
          : node
      ))
      const treeState = deps.withTree(nextNodes)
      set({ ...treeState, notes: notesFromNodes(treeState.nodes) })
    } catch (error) {
      set({ error: `No se pudo cambiar el icono: ${deps.normalizeError(error)}` })
    }
  },
  moveNodeById: async (id, newParentId) => {
    try {
      const validation = deps.isMoveValid(get().nodes, id, newParentId)
      if (!validation.ok) {
        set({ error: validation.reason ?? 'Movimiento invalido.' })
        return
      }

      const { position, updatedAt } = await moveNodeInDb(id, newParentId)
      const nextNodes = get().nodes.map((node) => (
        node.id === id
          ? { ...node, parentId: newParentId, position, updatedAt }
          : node
      ))
      const treeState = deps.withTree(nextNodes)
      set({ ...treeState, notes: notesFromNodes(treeState.nodes) })
    } catch (error) {
      set({ error: `No se pudo mover el nodo: ${deps.normalizeError(error)}` })
    }
  },
  addRelationByIds: async (sourceId, targetId) => {
    if (sourceId === targetId) {
      set({ error: 'Una nota no puede relacionarse consigo misma.' })
      return
    }

    try {
      await addNoteRelation(sourceId, targetId)
      const relationRows = await listNoteRelations()
      const noteRelations = deps.normalizeRelations(relationRows)
      set({ noteRelations, connections: noteRelations })
      await get().refreshGraph(undefined, noteRelations)
    } catch (error) {
      set({ error: `No se pudo guardar la relacion: ${deps.normalizeError(error)}` })
    }
  },
  removeRelationByIds: async (sourceId, targetId) => {
    try {
      await removeNoteRelation(sourceId, targetId)
      const noteRelations = get().noteRelations.filter((relation) => (
        !(relation.sourceId === sourceId && relation.targetId === targetId)
      ))
      set({ noteRelations, connections: noteRelations })
      await get().refreshGraph(undefined, noteRelations)
    } catch (error) {
      set({ error: `No se pudo eliminar la relacion: ${deps.normalizeError(error)}` })
    }
  },
  connectNotes: async (sourceId, targetIds) => {
    const normalizedTargets = Array.from(new Set(
      targetIds
        .map((targetId) => targetId.trim())
        .filter((targetId) => targetId.length > 0 && targetId !== sourceId),
    ))

    if (normalizedTargets.length === 0) {
      return
    }

    try {
      const pairs: NoteRelation[] = normalizedTargets.flatMap((targetId) => [
        { sourceId, targetId },
        { sourceId: targetId, targetId: sourceId },
      ])

      for (const relation of pairs) {
        await addNoteRelation(relation.sourceId, relation.targetId)
      }

      const existingKeys = new Set(get().noteRelations.map((relation) => `${relation.sourceId}->${relation.targetId}`))
      const mergedRelations = [...get().noteRelations]
      for (const relation of pairs) {
        const key = `${relation.sourceId}->${relation.targetId}`
        if (!existingKeys.has(key)) {
          existingKeys.add(key)
          mergedRelations.push(relation)
        }
      }

      set({
        noteRelations: mergedRelations,
        connections: mergedRelations,
        recentConnectionIds: normalizedTargets,
        ignoredSuggestionPairs: get().ignoredSuggestionPairs.filter((pair) => (
          !normalizedTargets.some((targetId) => (
            pair === `${sourceId}->${targetId}` || pair === `${targetId}->${sourceId}`
          ))
        )),
        error: null,
      })
      await get().refreshGraph(undefined, mergedRelations)
    } catch (error) {
      set({ error: `No se pudieron conectar las notas: ${deps.normalizeError(error)}` })
    }
  },
  ignoreConnectionSuggestion: async (sourceId, targetId) => {
    const normalizedSource = sourceId.trim()
    const normalizedTarget = targetId.trim()
    if (!normalizedSource || !normalizedTarget || normalizedSource === normalizedTarget) {
      return
    }

    const forwardKey = `${normalizedSource}->${normalizedTarget}`
    const reverseKey = `${normalizedTarget}->${normalizedSource}`
    if (get().ignoredSuggestionPairs.includes(forwardKey)) {
      return
    }

    try {
      await ignoreConnectionSuggestionInDb(normalizedSource, normalizedTarget)
      await ignoreConnectionSuggestionInDb(normalizedTarget, normalizedSource)
      set({
        ignoredSuggestionPairs: [...get().ignoredSuggestionPairs, forwardKey, reverseKey],
        error: null,
      })
    } catch (error) {
      set({ error: `No se pudo ignorar la sugerencia: ${deps.normalizeError(error)}` })
    }
  },
  getBacklinks: (noteId) => {
    const sourceIds = new Set(
      get().noteRelations
        .filter((relation) => relation.targetId === noteId)
        .map((relation) => relation.sourceId),
    )
    return notesFromNodes(get().nodes).filter((note) => sourceIds.has(note.id))
  },
  pinNote: (noteId) => {
    const current = get()
    if (current.pinnedNoteIds.includes(noteId)) {
      return
    }

    const nextPinnedNoteIds = [...current.pinnedNoteIds, noteId]
    set({ pinnedNoteIds: nextPinnedNoteIds })
    void persistPinnedNotes(set, get, deps, nextPinnedNoteIds)
  },
  unpinNote: (noteId) => {
    const nextPinnedNoteIds = get().pinnedNoteIds.filter((id) => id !== noteId)
    set({ pinnedNoteIds: nextPinnedNoteIds })
    void persistPinnedNotes(set, get, deps, nextPinnedNoteIds)
  },
  selectNode: (id) => {
    const node = get().nodes.find((item) => item.id === id)
    set({
      selectedNodeId: id,
      activeNoteId: node?.type === 'note' ? id : null,
      activeView: node?.type === 'note' ? 'editor' : 'workspace',
      saveStatus: 'idle',
      error: null,
    })
  },
  setActiveNote: (id) => {
    set({
      selectedNodeId: id,
      activeNoteId: id,
      activeView: id ? 'editor' : 'workspace',
      viewMode: id ? 'editor' : 'workspace',
      saveStatus: 'idle',
      error: null,
    })
  },
  setActiveView: (view) => {
    set({ activeView: view, viewMode: view })
  },
  setViewMode: (mode) => {
    set({ viewMode: mode, activeView: activeViewFromMode(mode) })
  },
})
