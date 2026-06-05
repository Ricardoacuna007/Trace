import type { NodeType } from '../types/workspace'

export type NodeIconKey =
  | 'workspace'
  | 'folder'
  | 'note'
  | 'sticky-note'
  | 'notebook'
  | 'bookmark'
  | 'tag'
  | 'star'
  | 'hash'

export interface NodeIconOption {
  key: NodeIconKey
  label: string
}

const DEFAULT_ICON_BY_TYPE: Record<NodeType, NodeIconKey> = {
  workspace: 'workspace',
  folder: 'folder',
  note: 'note',
}

const LEGACY_ICON_BY_VALUE: Record<string, NodeIconKey> = {
  workspace: 'workspace',
  'layers-3': 'workspace',
  layers3: 'workspace',
  folder: 'folder',
  note: 'note',
  file: 'note',
  'file-text': 'note',
  'sticky-note': 'sticky-note',
  notebook: 'notebook',
  bookmark: 'bookmark',
  tag: 'tag',
  star: 'star',
  hash: 'hash',
  ['\u{1F4BC}']: 'workspace',
  ['\u{1F4C1}']: 'folder',
  ['\u{1F4DD}']: 'note',
  ['\u{1F4C4}']: 'note',
}

const ICON_OPTIONS_BY_TYPE: Record<NodeType, NodeIconOption[]> = {
  workspace: [
    { key: 'workspace', label: 'Workspace' },
    { key: 'bookmark', label: 'Bookmark' },
    { key: 'star', label: 'Star' },
    { key: 'tag', label: 'Tag' },
  ],
  folder: [
    { key: 'folder', label: 'Folder' },
    { key: 'bookmark', label: 'Bookmark' },
    { key: 'tag', label: 'Tag' },
    { key: 'star', label: 'Star' },
  ],
  note: [
    { key: 'note', label: 'Note' },
    { key: 'sticky-note', label: 'Sticky note' },
    { key: 'notebook', label: 'Notebook' },
    { key: 'hash', label: 'Hash' },
  ],
}

export function getNodeIconOptions(nodeType: NodeType): NodeIconOption[] {
  return ICON_OPTIONS_BY_TYPE[nodeType]
}

export function normalizeNodeIconKey(rawIcon?: string | null): NodeIconKey | null {
  const normalized = rawIcon?.trim().toLowerCase()
  if (!normalized) {
    return null
  }
  return LEGACY_ICON_BY_VALUE[normalized] ?? null
}

export function resolveNodeIconKey(nodeType: NodeType, rawIcon?: string | null): NodeIconKey {
  return normalizeNodeIconKey(rawIcon) ?? DEFAULT_ICON_BY_TYPE[nodeType]
}

export function getNodeTypeIconColor(nodeType: NodeType): string {
  if (nodeType === 'workspace') return 'text-sky-300/90'
  if (nodeType === 'folder') return 'text-amber-300/90'
  return 'text-slate-200'
}
