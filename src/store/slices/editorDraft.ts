import type { Note } from '../../types/note'
import type { AppNode, TreeNode } from '../../types/workspace'
import { notesFromNodes } from '../../lib/workspace'
import type { NotesState } from '../types'

export interface EditorSliceDeps {
  withTree: (nodes: AppNode[]) => { nodes: AppNode[]; nodeTree: TreeNode[] }
  normalizeError: (error: unknown) => string
  markSaved: (set: (partial: Partial<NotesState>) => void, get: () => NotesState) => void
  defaultNoteTitle: string
  contentAutosaveDelayMs: number
  titleAutosaveDelayMs: number
  contentSaveTimers: Map<string, ReturnType<typeof setTimeout>>
  titleSaveTimers: Map<string, ReturnType<typeof setTimeout>>
}

export function cloneNote(note: Note): Note {
  return {
    ...note,
    tags: note.tags ? [...note.tags] : [],
  }
}

export function normalizedRelationIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0))).sort()
}

function isSameDraft(
  activeNote: Note | null,
  draftNote: Note | null,
  activeRelationIds: string[],
  draftRelationIds: string[],
): boolean {
  if (!activeNote || !draftNote) {
    return activeNote === draftNote && activeRelationIds.length === draftRelationIds.length
  }
  if (activeNote.id !== draftNote.id) {
    return false
  }

  const activeTags = [...(activeNote.tags ?? [])].sort()
  const draftTags = [...(draftNote.tags ?? [])].sort()
  if (activeTags.length !== draftTags.length) {
    return false
  }
  for (let index = 0; index < activeTags.length; index += 1) {
    if (activeTags[index] !== draftTags[index]) {
      return false
    }
  }

  const activeRelations = normalizedRelationIds(activeRelationIds)
  const draftRelations = normalizedRelationIds(draftRelationIds)
  if (activeRelations.length !== draftRelations.length) {
    return false
  }
  for (let index = 0; index < activeRelations.length; index += 1) {
    if (activeRelations[index] !== draftRelations[index]) {
      return false
    }
  }

  return (
    activeNote.title === draftNote.title
    && activeNote.content === draftNote.content
  )
}

export function scheduleDraftCommit(
  noteId: string,
  get: () => NotesState,
  deps: EditorSliceDeps,
) {
  if (!get().uiModules.enable_autosave) {
    return
  }

  const previousContentTimer = deps.contentSaveTimers.get(noteId)
  if (previousContentTimer) {
    clearTimeout(previousContentTimer)
  }
  const previousTitleTimer = deps.titleSaveTimers.get(noteId)
  if (previousTitleTimer) {
    clearTimeout(previousTitleTimer)
  }

  const delay = Math.max(deps.contentAutosaveDelayMs, deps.titleAutosaveDelayMs)
  const timer = setTimeout(() => {
    void get().commitDraftToDB(noteId)
  }, delay)

  deps.contentSaveTimers.set(noteId, timer)
  deps.titleSaveTimers.set(noteId, timer)
}

export function clearDraftTimers(noteId: string, deps: EditorSliceDeps) {
  const contentTimer = deps.contentSaveTimers.get(noteId)
  if (contentTimer) {
    clearTimeout(contentTimer)
    deps.contentSaveTimers.delete(noteId)
  }
  const titleTimer = deps.titleSaveTimers.get(noteId)
  if (titleTimer) {
    clearTimeout(titleTimer)
    deps.titleSaveTimers.delete(noteId)
  }
}

export function updateDraftState(
  set: (partial: Partial<NotesState>) => void,
  get: () => NotesState,
  deps: EditorSliceDeps,
  noteUpdater: (draft: Note) => Note,
  relationUpdater?: (relations: string[]) => string[],
) {
  const state = get()
  if (!state.draftNote || !state.activeNote) {
    return
  }

  const nextDraftNote = noteUpdater(cloneNote(state.draftNote))
  const nextDraftRelations = relationUpdater
    ? relationUpdater([...state.draftRelatedNoteIds])
    : [...state.draftRelatedNoteIds]
  const nextIsDirty = !isSameDraft(
    state.activeNote,
    nextDraftNote,
    state.noteRelations
      .filter((relation) => relation.sourceId === state.activeNote.id)
      .map((relation) => relation.targetId),
    nextDraftRelations,
  )

  const nextNodes = state.nodes.map((node) => (
    node.id === nextDraftNote.id && node.type === 'note'
      ? {
        ...node,
        title: nextDraftNote.title,
        content: nextDraftNote.content,
        tags: nextDraftNote.tags,
      }
      : node
  ))
  const treeState = deps.withTree(nextNodes)

  set({
    ...treeState,
    notes: notesFromNodes(treeState.nodes),
    draftNote: nextDraftNote,
    draftRelatedNoteIds: nextDraftRelations,
    isDirty: nextIsDirty,
    saveStatus: nextIsDirty && state.uiModules.enable_autosave ? 'saving' : 'idle',
    error: null,
  })
}
