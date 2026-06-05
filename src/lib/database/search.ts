import { invoke } from '@tauri-apps/api/core'
import { isTauriRuntime } from './runtime'
import type { NoteBacklink, NoteSearchResult } from './types'

export async function searchNotesGlobal(query: string, limit = 20): Promise<NoteSearchResult[]> {
  if (!isTauriRuntime()) {
    return []
  }

  const rows = await invoke<Array<{ noteId: string; title: string; snippet: string; score: number }>>(
    'search_notes',
    { query, limit },
  )

  return rows.map((row) => ({
    noteId: row.noteId,
    title: row.title,
    snippet: row.snippet,
    score: row.score,
  }))
}

export async function getNoteBacklinks(noteId: string, limit = 50): Promise<NoteBacklink[]> {
  if (!isTauriRuntime()) {
    return []
  }

  const rows = await invoke<Array<{ sourceId: string; title: string; preview: string; updatedAt: string }>>(
    'get_backlinks',
    { targetId: noteId, limit },
  )

  return rows.map((row) => ({
    sourceId: row.sourceId,
    title: row.title,
    preview: row.preview,
    updatedAt: row.updatedAt,
  }))
}
