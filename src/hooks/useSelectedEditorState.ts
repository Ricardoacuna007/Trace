import { useEffect, useMemo } from 'react'
import { isContainerNode, sortByPosition } from '../lib/workspace'
import type { NoteRelation } from '../store/types'
import type { Note } from '../types/note'
import type { AppNode } from '../types/workspace'

interface UseSelectedEditorStateParams {
  beginNoteDraft: (noteId: string | null) => void
  draftNote: Note | null
  draftRelatedNoteIds: string[]
  hasPendingChanges: (noteId: string) => boolean
  isDirty: boolean
  nodes: AppNode[]
  noteRelations: NoteRelation[]
  selectedNodeId: string | null
}

export function useSelectedEditorState({
  beginNoteDraft,
  draftNote,
  draftRelatedNoteIds,
  hasPendingChanges,
  isDirty,
  nodes,
  noteRelations,
  selectedNodeId,
}: UseSelectedEditorStateParams) {
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  )

  const breadcrumbs = useMemo(() => {
    if (!selectedNodeId) {
      return []
    }

    const byId = new Map(nodes.map((node) => [node.id, node]))
    const path: AppNode[] = []
    const visited = new Set<string>()

    let cursor = byId.get(selectedNodeId)
    while (cursor && !visited.has(cursor.id)) {
      path.unshift(cursor)
      visited.add(cursor.id)
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
    }

    return path
  }, [nodes, selectedNodeId])

  const selectedContainerChildren = useMemo(() => {
    if (!isContainerNode(selectedNode)) {
      return []
    }
    return nodes
      .filter((node) => node.parentId === selectedNode.id)
      .sort(sortByPosition)
  }, [nodes, selectedNode])

  const selectedPersistedNote = useMemo<Note | null>(() => {
    if (!selectedNode || selectedNode.type !== 'note' || typeof selectedNode.content !== 'string') {
      return null
    }
    return selectedNode as Note
  }, [selectedNode])

  useEffect(() => {
    beginNoteDraft(selectedPersistedNote?.id ?? null)
  }, [beginNoteDraft, selectedPersistedNote?.id])

  const selectedNote = useMemo<Note | null>(() => {
    if (!selectedPersistedNote) {
      return null
    }
    if (draftNote && draftNote.id === selectedPersistedNote.id) {
      return draftNote
    }
    return selectedPersistedNote
  }, [draftNote, selectedPersistedNote])

  const relatedNoteIds = useMemo(() => {
    if (!selectedNote) {
      return []
    }
    if (draftNote && draftNote.id === selectedNote.id) {
      return draftRelatedNoteIds
    }
    return noteRelations
      .filter((relation) => relation.sourceId === selectedNote.id)
      .map((relation) => relation.targetId)
  }, [draftNote, draftRelatedNoteIds, noteRelations, selectedNote])

  const noteCandidates = useMemo(() => {
    return nodes
      .filter((node) => node.type === 'note')
      .map((note) => ({ id: note.id, title: note.title }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [nodes])

  const isActiveNoteDirty = useMemo(() => {
    if (!selectedNote) {
      return false
    }
    if (draftNote && draftNote.id === selectedNote.id) {
      return isDirty
    }
    return hasPendingChanges(selectedNote.id)
  }, [draftNote, hasPendingChanges, isDirty, selectedNote])

  return {
    breadcrumbs,
    isActiveNoteDirty,
    noteCandidates,
    relatedNoteIds,
    selectedContainerChildren,
    selectedNode,
    selectedNote,
  }
}
