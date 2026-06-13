export type {
  ActiveVaultInfo,
  ImportSummary,
  MarkdownDbColumn,
  MarkdownDbRow,
  MarkdownDbSnapshot,
  NoteBacklink,
  NoteSearchResult,
  TraceConfig,
  TraceEditorSettings,
  TraceGraphSettings,
  TraceLayoutConfig,
  TraceRightPanelMode,
  TraceSidebarPosition,
  TraceUIModules,
  TraceVisibleElements,
  VaultCustomization,
} from './database/types'

export {
  getActiveVault,
  getCurrentVaultPath,
  setActiveVault,
} from './database/runtime'

export {
  addNoteRelation,
  changeNodeIcon,
  commitNoteDraftSnapshot,
  createInboxNote,
  createNode,
  deleteNode,
  listNoteRelations,
  listIgnoredSuggestions,
  listNodes,
  moveNode,
  persistNote,
  removeNoteRelation,
  renameNode,
  ignoreConnectionSuggestion,
  updateNoteContent,
  updateNoteTags,
  updateNoteTitle,
  upsertSyncedNote,
} from './database/nodes'

export {
  getNoteBacklinks,
  searchNotesGlobal,
} from './database/search'

export {
  parseTraceConfig,
  readVaultCustomization,
  saveVaultCustomization,
} from './database/customization'

export {
  exportCurrentNoteMarkdown,
  exportVaultMarkdown,
  importMarkdownDirectory,
  scanMarkdownDatabase,
  updateMarkdownFrontmatterProperty,
} from './database/markdown'
