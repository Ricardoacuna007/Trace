import {
  listNodes,
  listNoteRelations,
  readVaultCustomization,
  scanMarkdownDatabase,
} from '../../lib/db'
import type { NoteGraphData } from '../../features/notes-graph/graph'
import type { AppNode, TreeNode } from '../../types/workspace'
import { notesFromNodes } from '../../lib/workspace'
import type { NoteRelation, NotesState } from '../types'

export interface VaultSliceDeps {
  defaultTraceConfigJson: string
  emptyGraph: NoteGraphData
  normalizeError: (error: unknown) => string
  normalizeRelations: (rows: Array<{ source_id: string; target_id: string }>) => NoteRelation[]
  withTree: (nodes: AppNode[]) => { nodes: AppNode[]; nodeTree: TreeNode[] }
}

function fallbackCustomization(defaultTraceConfigJson: string) {
  return {
    traceDir: '',
    configJson: defaultTraceConfigJson,
    customCss: '',
  }
}

export function createEmptyVaultState(deps: VaultSliceDeps): Partial<NotesState> {
  return {
    nodes: [],
    notes: [],
    nodeTree: [],
    noteRelations: [],
    connections: [],
    graphData: deps.emptyGraph,
    activeVaultPath: null,
    selectedNodeId: null,
    activeNoteId: null,
    activeView: 'workspace',
    traceDir: null,
    traceConfigJson: deps.defaultTraceConfigJson,
    customCss: '',
    customizationLoading: false,
    customizationSaving: false,
    ioWorking: false,
    ioMessage: null,
    markdownDbLoading: false,
    markdownDbSnapshot: null,
    loading: false,
    initialized: true,
    vaultRequired: true,
    commandSearchQuery: '',
    commandSearchResults: [],
    commandSearchLoading: false,
    activeNote: null,
    draftNote: null,
    draftRelatedNoteIds: [],
    isDirty: false,
    saveStatus: 'idle',
    error: null,
  }
}

export async function hydrateVaultState(
  set: (partial: Partial<NotesState>) => void,
  get: () => NotesState,
  activeVaultPath: string,
  deps: VaultSliceDeps,
) {
  const nodes = await listNodes()
  const relationRows = await listNoteRelations()
  const noteRelations = deps.normalizeRelations(relationRows)
  const treeState = deps.withTree(nodes)
  const selected = treeState.nodes.find((node) => node.type === 'workspace')
    ?? treeState.nodes[0]
    ?? null

  let customization = fallbackCustomization(deps.defaultTraceConfigJson)
  let customizationError: string | null = null
  let markdownSnapshot = null

  try {
    customization = await readVaultCustomization()
  } catch (error) {
    customizationError = `No se pudo leer la configuracion de la boveda: ${deps.normalizeError(error)}`
  }

  try {
    markdownSnapshot = await scanMarkdownDatabase()
  } catch (error) {
    const message = `No se pudo indexar Markdown local: ${deps.normalizeError(error)}`
    customizationError = customizationError ? `${customizationError} | ${message}` : message
  }

  set({
    ...treeState,
    notes: notesFromNodes(treeState.nodes),
    noteRelations,
    connections: noteRelations,
    selectedNodeId: selected?.id ?? null,
    activeNoteId: selected?.type === 'note' ? selected.id : null,
    activeView: selected?.type === 'note' ? 'editor' : 'workspace',
    traceDir: customization.traceDir || null,
    traceConfigJson: customization.configJson || deps.defaultTraceConfigJson,
    customCss: customization.customCss ?? '',
    customizationLoading: false,
    customizationSaving: false,
    markdownDbLoading: false,
    markdownDbSnapshot: markdownSnapshot,
    activeVaultPath,
    vaultRequired: false,
    initialized: true,
    loading: false,
    commandSearchQuery: '',
    commandSearchResults: [],
    commandSearchLoading: false,
    activeNote: null,
    draftNote: null,
    draftRelatedNoteIds: [],
    isDirty: false,
    saveStatus: 'idle',
    error: customizationError,
  })

  get().hydrateUIFromConfig(customization.configJson || deps.defaultTraceConfigJson)
  await get().refreshGraph(treeState.nodes, noteRelations)
}
