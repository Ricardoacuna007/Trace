import { useEffect, useState } from 'react'
import { getNoteBacklinks, type NoteBacklink } from '../lib/db'

interface BacklinksState {
  noteId: string | null
  items: NoteBacklink[]
}

export function useBacklinks(noteId: string | null): NoteBacklink[] {
  const [backlinksState, setBacklinksState] = useState<BacklinksState>({
    noteId: null,
    items: [],
  })

  useEffect(() => {
    let cancelled = false

    if (!noteId) {
      return
    }

    void (async () => {
      try {
        const results = await getNoteBacklinks(noteId, 50)
        if (!cancelled) {
          setBacklinksState({ noteId, items: results })
        }
      } catch {
        if (!cancelled) {
          setBacklinksState({ noteId, items: [] })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [noteId])

  return noteId && noteId === backlinksState.noteId ? backlinksState.items : []
}
