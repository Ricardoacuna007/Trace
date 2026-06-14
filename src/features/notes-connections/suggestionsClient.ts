import { isTauri } from '../../lib/env'
import { apiJson } from '../../lib/http'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import { pairKey, type ConnectionSuggestion } from './suggestions'

interface NativeConnectionSuggestion {
  targetId: string
  title: string
  fragment: string
  score: number
  scorePercent: number
}

export async function loadNativeConnectionSuggestions(noteId: string, limit = 5): Promise<NativeConnectionSuggestion[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<NativeConnectionSuggestion[]>('suggest_note_connections', { noteId, limit })
  }

  return apiJson<NativeConnectionSuggestion[]>(
    `/api/notes/${encodeURIComponent(noteId)}/suggestions?limit=${limit}`,
  )
}

export function nativeToConnectionSuggestions(
  sourceId: string,
  nativeSuggestions: NativeConnectionSuggestion[],
  nodes: AppNode[],
  relations: NoteRelation[],
  ignoredPairs: Set<string>,
): ConnectionSuggestion[] {
  return nativeSuggestions
    .map((suggestion) => {
      const note = nodes.find((node): node is Note => (
        node.id === suggestion.targetId
        && node.type === 'note'
        && typeof node.content === 'string'
      ))
      if (!note || isConnected(sourceId, note.id, relations) || ignoredPairs.has(pairKey(sourceId, note.id))) {
        return null
      }

      return {
        note,
        fragment: suggestion.fragment,
        score: suggestion.score,
        scorePercent: suggestion.scorePercent,
      } satisfies ConnectionSuggestion
    })
    .filter((suggestion): suggestion is ConnectionSuggestion => suggestion !== null)
}

function isConnected(sourceId: string, targetId: string, relations: NoteRelation[]): boolean {
  return relations.some((relation) => (
    (relation.sourceId === sourceId && relation.targetId === targetId)
    || (relation.sourceId === targetId && relation.targetId === sourceId)
  ))
}
