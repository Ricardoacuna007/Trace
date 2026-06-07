import { countWords, plainTextFromContent, previewFromContent } from '../../features/notes-editor/contentMetrics'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const MONTH_MS = 30 * 24 * 60 * 60 * 1000
const NOTE_TYPES = new Set(['paragraph', 'heading', 'quote', 'bulletListItem', 'numberedListItem', 'checkListItem'])

export interface WeeklyActivityItem {
  note: Note
  words: number
  connectionCount: number
  intensity: number
}

export interface UnfinishedNoteItem {
  note: Note
  reason: string
}

export interface WorkspaceInsights {
  notes: Note[]
  totalWords: number
  lastSession: Note | null
  weeklyActivity: WeeklyActivityItem[]
  unfinished: UnfinishedNoteItem[]
  oldNote: Note | null
}

export function buildWorkspaceInsights(
  nodes: AppNode[],
  noteRelations: NoteRelation[],
  now = Date.now(),
): WorkspaceInsights {
  const notes = nodes
    .filter((node): node is Note => (
      node.type === 'note'
      && typeof node.content === 'string'
      && !node.inbox
    ))
    .sort((a, b) => timestampOf(b.updatedAt) - timestampOf(a.updatedAt))

  const totalWords = notes.reduce((total, note) => total + countWords(note.content), 0)
  const connectionCounts = connectionCountByNote(noteRelations)
  const lastSession = notes[0] ?? null
  const weeklyNotes = notes.filter((note) => now - timestampOf(note.updatedAt) <= WEEK_MS).slice(0, 4)
  const weeklyActivity = weeklyNotes.map((note, index) => ({
    note,
    words: countWords(note.content),
    connectionCount: connectionCounts.get(note.id) ?? 0,
    intensity: Math.max(24, 100 - index * 18),
  }))
  const unfinished = notes
    .map((note) => {
      const reason = unfinishedReason(note.content)
      return reason ? { note, reason } : null
    })
    .filter((item): item is UnfinishedNoteItem => item !== null)
    .slice(0, 3)
  const oldNote = notes
    .filter((note) => now - timestampOf(note.updatedAt) >= MONTH_MS)
    .sort((a, b) => timestampOf(a.updatedAt) - timestampOf(b.updatedAt))[0] ?? null

  return {
    notes,
    totalWords,
    lastSession,
    weeklyActivity,
    unfinished,
    oldNote,
  }
}

export function notePreview(note: Note): string {
  return previewFromContent(note.content)
}

function connectionCountByNote(relations: NoteRelation[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const relation of relations) {
    counts.set(relation.sourceId, (counts.get(relation.sourceId) ?? 0) + 1)
    counts.set(relation.targetId, (counts.get(relation.targetId) ?? 0) + 1)
  }
  return counts
}

function unfinishedReason(content: string): string | null {
  if (hasOpenChecklist(content)) {
    return 'lista con pendientes abiertos'
  }

  const text = plainTextFromContent(content)
  const lastLine = text.split('\n').map((line) => line.trim()).filter(Boolean).at(-1)
  if (!lastLine || lastLine.length < 18) {
    return null
  }

  return /[.!?:;)]$/.test(lastLine) ? null : 'termina en mitad de frase'
}

function hasOpenChecklist(content: string): boolean {
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) && parsed.some((block) => blockHasOpenChecklist(block))
  } catch {
    return false
  }
}

function blockHasOpenChecklist(block: unknown): boolean {
  const record = readRecord(block)
  if (!record) {
    return false
  }

  if (record.type === 'checkListItem') {
    const props = readRecord(record.props)
    if (props?.checked !== true) {
      return true
    }
  }

  if (typeof record.type === 'string' && !NOTE_TYPES.has(record.type)) {
    return false
  }

  return Array.isArray(record.children) && record.children.some((child) => blockHasOpenChecklist(child))
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function timestampOf(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}
