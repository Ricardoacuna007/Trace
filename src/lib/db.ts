export type {
  ActiveVaultInfo,
  ImportSummary,
  MarkdownDbColumn,
  MarkdownDbRow,
  MarkdownDbSnapshot,
  NoteBacklink,
  NoteSearchResult,
  TraceConfig,
  TraceUIModules,
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
  createNode,
  deleteNode,
  listNoteRelations,
  listNodes,
  moveNode,
  persistNote,
  removeNoteRelation,
  renameNode,
  updateNoteContent,
  updateNoteTags,
  updateNoteTitle,
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
