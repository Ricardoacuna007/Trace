import type { AppNode, NodeType } from '../../types/workspace'

export interface NodeRow {
  id: string
  title: string
  type: NodeType
  parent_id: string | null
  content: string | null
  icon: string | null
  tags: string | null
  inbox: number | boolean | null
  position: number
  updated_at: string
}

export interface LegacyNoteRow {
  id: number
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface RelationRow {
  source_id: string
  target_id: string
}

export interface NoteSearchResult {
  noteId: string
  title: string
  snippet: string
  score: number
}

export interface NoteBacklink {
  sourceId: string
  title: string
  preview: string
  updatedAt: string
}

export interface TraceUIModules {
  show_breadcrumbs: boolean
  show_backlinks: boolean
  show_node_icons: boolean
  enable_autosave: boolean
}

export type TraceSidebarPosition = 'left' | 'right' | 'hidden'
export type TraceRightPanelMode = 'visible' | 'collapsed' | 'hidden'

export interface TraceVisibleElements {
  breadcrumb: boolean
  metabar: boolean
  word_count: boolean
  modified_at: boolean
  titlebar: boolean
  traffic_lights: boolean
}

export interface TraceLayoutConfig {
  sidebar_position: TraceSidebarPosition
  right_panel: TraceRightPanelMode
  visible_elements: TraceVisibleElements
}

export interface TraceConfig {
  theme: 'dark' | 'light'
  accent_color: string
  font_family: string
  editor_width: 'full' | 'centered' | string
  vim_mode: boolean
  layout: TraceLayoutConfig
  ui_modules: TraceUIModules
  pinned_note_ids: string[]
  [key: string]: unknown
}

export interface VaultCustomization {
  traceDir: string
  configJson: string
  customCss: string
}

export interface ImportSummary {
  workspaceId: string
  workspaceTitle: string
  importedNotes: number
  createdRelations: number
}

export interface MarkdownDbColumn {
  key: string
  valueType: string
}

export interface MarkdownDbRow {
  id: string
  filePath: string
  relativePath: string
  title: string
  properties: Record<string, unknown>
  modifiedAt: string
  indexedAt: string
}

export interface MarkdownDbSnapshot {
  vaultPath: string
  indexedFiles: number
  columns: MarkdownDbColumn[]
  rows: MarkdownDbRow[]
  generatedAt: string
}

export interface ActiveVaultInfo {
  vaultPath: string
  dbPath: string
  dbUrl: string
}

export type NewNodeParams = {
  type: NodeType
  title?: string
  parentId?: string | null
  content?: string
  icon?: string | null
  tags?: string[]
  inbox?: boolean
}

export type AppNoteNode = AppNode & {
  type: 'note'
  content: string
}
