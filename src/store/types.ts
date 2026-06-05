import type { Block } from '@blocknote/core'
import type { StateCreator } from 'zustand'
import type { GraphComputeMode, NoteGraphData } from '../features/notes-graph/graph'
import type { ImportSummary, MarkdownDbSnapshot, NoteSearchResult, TraceUIModules } from '../lib/db'
import type { Note } from '../types/note'
import type { AppNode, TreeNode } from '../types/workspace'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
export type AppViewMode = 'editor' | 'graph' | 'workspace'
export type ViewMode = AppViewMode | 'settings' | 'database'

export interface NoteRelation {
  sourceId: string
  targetId: string
}

export interface VaultSlice {
  traceDir: string | null
  traceConfigJson: string
  customCss: string
  customizationLoading: boolean
  customizationSaving: boolean
  ioWorking: boolean
  ioMessage: string | null
  markdownDbLoading: boolean
  markdownDbSnapshot: MarkdownDbSnapshot | null
  activeVaultPath: string | null
  vaultRequired: boolean
  loading: boolean
  initialized: boolean
  initialize: () => Promise<void>
  selectVaultPath: (vaultPath: string) => Promise<void>
  loadVaultCustomization: () => Promise<void>
  saveVaultCustomization: (configJson: string, customCss: string, options?: { silent?: boolean }) => Promise<void>
  importMarkdownFromDir: (sourceDir: string) => Promise<ImportSummary | null>
  exportCurrentNoteToMarkdown: (noteId: string, outputDir: string) => Promise<string | null>
  exportVaultToMarkdown: (outputDir: string) => Promise<number | null>
  refreshMarkdownDatabase: () => Promise<void>
  updateMarkdownDatabaseProperty: (filePath: string, key: string, value: unknown) => Promise<void>
  clearIoMessage: () => void
}

export interface GraphSlice {
  graphData: NoteGraphData
  graphComputeMode: GraphComputeMode
  refreshGraph: (nodesOverride?: AppNode[], relationsOverride?: NoteRelation[]) => Promise<void>
}

export interface SearchSlice {
  commandSearchQuery: string
  commandSearchResults: NoteSearchResult[]
  commandSearchLoading: boolean
  runGlobalSearch: (query: string) => Promise<void>
  clearGlobalSearch: () => void
}

export interface WorkspaceSlice {
  workspaceSystemEnabled: boolean
  nodes: AppNode[]
  notes: Note[]
  nodeTree: TreeNode[]
  noteRelations: NoteRelation[]
  connections: NoteRelation[]
  selectedNodeId: string | null
  activeNoteId: string | null
  activeView: AppViewMode
  viewMode: ViewMode
  pinnedNoteIds: string[]
  recentConnectionIds: string[]
  createWorkspace: () => Promise<void>
  createFolder: (parentId?: string | null) => Promise<void>
  createNewNote: (parentId?: string | null) => Promise<void>
  createNoteFromTitle: (title: string, parentId?: string | null) => Promise<string | null>
  loadNotes: () => Promise<void>
  deleteNodeById: (id: string) => Promise<void>
  renameNodeById: (id: string, title: string) => Promise<void>
  changeNodeIconById: (id: string, icon: string) => Promise<void>
  moveNodeById: (id: string, newParentId: string | null) => Promise<void>
  addRelationByIds: (sourceId: string, targetId: string) => Promise<void>
  removeRelationByIds: (sourceId: string, targetId: string) => Promise<void>
  connectNotes: (sourceId: string, targetIds: string[]) => Promise<void>
  getBacklinks: (noteId: string) => Note[]
  pinNote: (noteId: string) => void
  unpinNote: (noteId: string) => void
  selectNode: (id: string) => void
  setActiveNote: (id: string | null) => void
  setActiveView: (view: AppViewMode) => void
  setViewMode: (mode: ViewMode) => void
}

export interface EditorSlice {
  saveStatus: SaveStatus
  activeNote: Note | null
  draftNote: Note | null
  draftRelatedNoteIds: string[]
  isDirty: boolean
  beginNoteDraft: (noteId: string | null) => void
  discardDraft: () => void
  commitDraftToDB: (noteId?: string) => Promise<void>
  addDraftRelation: (targetId: string) => void
  removeDraftRelation: (targetId: string) => void
  setNoteTagsById: (noteId: string, tags: string[]) => Promise<void>
  queueNoteTitleSave: (noteId: string, title: string) => void
  queueSaveContent: (noteId: string, blocks: Block[]) => void
  saveNoteNow: (noteId?: string) => Promise<void>
  hasPendingChanges: (noteId: string) => boolean
}

export interface SharedSlice {
  error: string | null
}

export interface UISlice {
  editorWidth: 'full' | 'centered'
  isSidebarOpen: boolean
  isPropertiesPanelOpen: boolean
  isBacklinksPanelOpen: boolean
  isConnectModalOpen: boolean
  uiModules: TraceUIModules
  hydrateUIFromConfig: (configJson: string) => void
  toggleSidebar: () => void
  togglePropertiesPanel: () => void
  toggleBacklinksPanel: () => void
  openConnectModal: () => void
  closeConnectModal: () => void
  updateUIModule: (module: keyof TraceUIModules, value: boolean) => Promise<void>
  setEditorWidth: (width: 'full' | 'centered') => Promise<void>
}

export interface NotesState extends
  SharedSlice,
  VaultSlice,
  UISlice,
  GraphSlice,
  SearchSlice,
  WorkspaceSlice,
  EditorSlice {}

export type SliceCreator<TSlice> = StateCreator<NotesState, [], [], TSlice>
