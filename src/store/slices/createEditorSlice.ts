import type { Block } from '@blocknote/core'
import { commitNoteDraftSnapshot } from '../../lib/db'
import type { Note } from '../../types/note'
import { notesFromNodes, asNote } from '../../lib/workspace'
import type { NoteRelation, SliceCreator } from '../types'
import {
  clearDraftTimers,
  cloneNote,
  normalizedRelationIds,
  scheduleDraftCommit,
  updateDraftState,
  type EditorSliceDeps,
} from './editorDraft'

export const createEditorSlice = (deps: EditorSliceDeps): SliceCreator<{
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  activeNote: Note | null
  draftNote: Note | null
  draftRelatedNoteIds: string[]
  isDirty: boolean
  beginNoteDraft: (noteId: string | null) => void
  discardDraft: () => void
  commitDraftToDB: (noteId?: string) => Promise<void>
  addDraftRelation: (targetId: string) => void
  removeDraftRelation: (targetId: string) => void
  setNoteTagsById: (noteId: string, tags: string[]) => Promise<void>
  queueNoteTitleSave: (noteId: string, title: string) => void
  queueSaveContent: (noteId: string, blocks: Block[]) => void
  saveNoteNow: (noteId?: string) => Promise<void>
  hasPendingChanges: (noteId: string) => boolean
}> => (set, get) => ({
  saveStatus: 'idle',
  activeNote: null,
  draftNote: null,
  draftRelatedNoteIds: [],
  isDirty: false,
  beginNoteDraft: (noteId) => {
    if (!noteId) {
      set({
        activeNote: null,
        draftNote: null,
        draftRelatedNoteIds: [],
        isDirty: false,
        saveStatus: 'idle',
      })
      return
    }

    const node = get().nodes.find((item) => item.id === noteId)
    const note = asNote(node)
    if (!note) {
      set({
        activeNote: null,
        draftNote: null,
        draftRelatedNoteIds: [],
        isDirty: false,
        saveStatus: 'idle',
      })
      return
    }

    clearDraftTimers(noteId, deps)
    const relatedIds = get().noteRelations
      .filter((relation) => relation.sourceId === noteId)
      .map((relation) => relation.targetId)

    set({
      activeNote: cloneNote(note),
      draftNote: cloneNote(note),
      draftRelatedNoteIds: [...relatedIds],
      isDirty: false,
      saveStatus: 'idle',
      error: null,
    })
  },
  discardDraft: () => {
    const state = get()
    if (!state.activeNote) {
      return
    }

    clearDraftTimers(state.activeNote.id, deps)
    const relatedIds = state.noteRelations
      .filter((relation) => relation.sourceId === state.activeNote!.id)
      .map((relation) => relation.targetId)
    const nextNodes = state.nodes.map((node) => (
      node.id === state.activeNote!.id && node.type === 'note'
        ? {
          ...node,
          title: state.activeNote!.title,
          content: state.activeNote!.content,
          tags: state.activeNote!.tags,
        }
        : node
    ))
    const treeState = deps.withTree(nextNodes)

    set({
      ...treeState,
      notes: notesFromNodes(treeState.nodes),
      draftNote: cloneNote(state.activeNote),
      draftRelatedNoteIds: [...relatedIds],
      isDirty: false,
      saveStatus: 'idle',
      error: null,
    })
  },
  commitDraftToDB: async (noteId) => {
    const state = get()
    const draft = state.draftNote
    const active = state.activeNote
    const targetId = noteId ?? draft?.id ?? null
    if (!targetId || !draft || !active || draft.id !== targetId) {
      return
    }

    if (!state.isDirty) {
      return
    }

    clearDraftTimers(targetId, deps)

    set({
      saveStatus: 'saving',
      error: null,
    })

    try {
      const normalizedTitle = draft.title.trim().length > 0 ? draft.title : deps.defaultNoteTitle
      const { updatedAt } = await commitNoteDraftSnapshot(targetId, {
        title: normalizedTitle,
        content: draft.content,
        tags: draft.tags ?? [],
        relatedIds: state.draftRelatedNoteIds,
      })

      const nextNodes = state.nodes.map((node) => (
        node.id === targetId && node.type === 'note'
          ? {
            ...node,
            title: normalizedTitle,
            content: draft.content,
            tags: draft.tags,
            updatedAt,
          }
          : node
      ))
      const treeState = deps.withTree(nextNodes)
      const baseRelations = state.noteRelations.filter((relation) => relation.sourceId !== targetId)
      const draftRelations: NoteRelation[] = normalizedRelationIds(state.draftRelatedNoteIds).map((targetIdValue) => ({
        sourceId: targetId,
        targetId: targetIdValue,
      }))
      const nextRelations = [...baseRelations, ...draftRelations]
      const persistedNote = treeState.nodes.find((node) => node.id === targetId)
      const note = asNote(persistedNote)

      set({
        ...treeState,
        notes: notesFromNodes(treeState.nodes),
        noteRelations: nextRelations,
        connections: nextRelations,
        activeNote: note ? cloneNote(note) : null,
        draftNote: note ? cloneNote(note) : null,
        draftRelatedNoteIds: [...state.draftRelatedNoteIds],
        isDirty: false,
        saveStatus: 'saved',
        error: null,
      })

      await get().refreshGraph(treeState.nodes, nextRelations)
      deps.markSaved(set, get)
    } catch (error) {
      set({
        saveStatus: 'error',
        error: `No se pudo guardar la nota: ${deps.normalizeError(error)}`,
      })
    }
  },
  addDraftRelation: (targetId) => {
    updateDraftState(
      set,
      get,
      deps,
      (draft) => draft,
      (relations) => {
        if (relations.includes(targetId)) {
          return relations
        }
        return [...relations, targetId]
      },
    )

    const draftId = get().draftNote?.id
    if (draftId) {
      scheduleDraftCommit(draftId, get, deps)
    }
  },
  removeDraftRelation: (targetId) => {
    updateDraftState(
      set,
      get,
      deps,
      (draft) => draft,
      (relations) => relations.filter((id) => id !== targetId),
    )

    const draftId = get().draftNote?.id
    if (draftId) {
      scheduleDraftCommit(draftId, get, deps)
    }
  },
  setNoteTagsById: async (noteId, tags) => {
    if (get().draftNote?.id !== noteId) {
      get().beginNoteDraft(noteId)
    }
    updateDraftState(
      set,
      get,
      deps,
      (draft) => ({
        ...draft,
        tags: [...tags],
      }),
    )

    scheduleDraftCommit(noteId, get, deps)
  },
  queueNoteTitleSave: (noteId, title) => {
    if (get().draftNote?.id !== noteId) {
      get().beginNoteDraft(noteId)
    }
    const normalizedTitle = title.trim().length > 0 ? title : deps.defaultNoteTitle
    updateDraftState(
      set,
      get,
      deps,
      (draft) => ({
        ...draft,
        title: normalizedTitle,
      }),
    )
    scheduleDraftCommit(noteId, get, deps)
  },
  queueSaveContent: (noteId, blocks) => {
    if (get().draftNote?.id !== noteId) {
      get().beginNoteDraft(noteId)
    }
    const content = JSON.stringify(blocks)
    updateDraftState(
      set,
      get,
      deps,
      (draft) => ({
        ...draft,
        content,
      }),
    )
    scheduleDraftCommit(noteId, get, deps)
  },
  saveNoteNow: async (noteId) => {
    await get().commitDraftToDB(noteId)
  },
  hasPendingChanges: (noteId) => {
    const state = get()
    return state.isDirty && state.draftNote?.id === noteId
  },
})
