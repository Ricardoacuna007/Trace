import { useEffect } from 'react'
import { isContainerNode, isTypingTarget } from '../lib/workspace'
import type { Note } from '../types/note'
import type { AppNode } from '../types/workspace'

interface UseAppHotkeysParams {
  autosaveEnabled: boolean
  onCreateNote: () => void
  onOpenCommandPalette: () => void
  onSaveNoteNow: (noteId: string) => void
  onToggleSidebar: () => void
  selectedNode: AppNode | null
  selectedNote: Note | null
}

export function useAppHotkeys({
  autosaveEnabled,
  onCreateNote,
  onOpenCommandPalette,
  onSaveNoteNow,
  onToggleSidebar,
  selectedNode,
  selectedNote,
}: UseAppHotkeysParams): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      const isMetaShortcut = event.ctrlKey || event.metaKey

      if (isMetaShortcut && key === 'k') {
        event.preventDefault()
        onOpenCommandPalette()
        return
      }

      if (isMetaShortcut && key === 'n') {
        event.preventDefault()
        onCreateNote()
        return
      }

      if (isMetaShortcut && key === '\\') {
        event.preventDefault()
        onToggleSidebar()
        return
      }

      if (isMetaShortcut && key === 's') {
        if (!autosaveEnabled && selectedNote) {
          event.preventDefault()
          onSaveNoteNow(selectedNote.id)
        }
        return
      }

      if (isTypingTarget(event.target)) {
        return
      }

      if (!isMetaShortcut && !event.altKey && key === 'c' && isContainerNode(selectedNode)) {
        event.preventDefault()
        onCreateNote()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    autosaveEnabled,
    onCreateNote,
    onOpenCommandPalette,
    onSaveNoteNow,
    onToggleSidebar,
    selectedNode,
    selectedNote,
  ])
}
