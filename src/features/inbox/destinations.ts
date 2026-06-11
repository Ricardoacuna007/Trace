import { suggestConnections } from '../notes-connections/suggestions'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'

export interface InboxDestination {
  id: string
  title: string
  type: 'workspace' | 'folder'
  score: number
  relatedCount: number
}

function containerLabel(node: AppNode): string {
  if (node.type === 'workspace') {
    return node.title || 'Workspace'
  }
  return node.title || 'Carpeta'
}

export function suggestInboxDestinations(
  note: Note,
  nodes: AppNode[],
  noteRelations: NoteRelation[],
  limit = 5,
): InboxDestination[] {
  if (!note.inbox) {
    return []
  }

  const containers = new Map(nodes
    .filter((node) => node.type === 'workspace' || node.type === 'folder')
    .map((node) => [node.id, node]))
  const scored = new Map<string, InboxDestination>()
  const suggestions = suggestConnections(note, nodes, noteRelations, new Set())

  for (const suggestion of suggestions) {
    const parentId = suggestion.note.parentId
    if (!parentId || !containers.has(parentId)) {
      continue
    }

    const container = containers.get(parentId)
    if (!container) {
      continue
    }

    const current = scored.get(parentId) ?? {
      id: parentId,
      title: containerLabel(container),
      type: container.type === 'folder' ? 'folder' : 'workspace',
      score: 0,
      relatedCount: 0,
    }
    current.score += suggestion.scorePercent
    current.relatedCount += 1
    scored.set(parentId, current)
  }

  for (const container of containers.values()) {
    if (!scored.has(container.id)) {
      scored.set(container.id, {
        id: container.id,
        title: containerLabel(container),
        type: container.type === 'folder' ? 'folder' : 'workspace',
        score: 0,
        relatedCount: 0,
      })
    }
  }

  return [...scored.values()]
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score
      }
      if (b.relatedCount !== a.relatedCount) {
        return b.relatedCount - a.relatedCount
      }
      return a.title.localeCompare(b.title)
    })
    .slice(0, limit)
}
