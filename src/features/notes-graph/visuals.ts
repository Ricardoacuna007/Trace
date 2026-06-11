import type { AppNode } from '../../types/workspace'
import { previewFromContent } from '../notes-editor/contentMetrics'
import type { NoteGraphData } from './graph'

export type GraphNodeKind = 'active' | 'bridge' | 'orphan' | 'normal'

export interface GraphNodeVisual {
  kind: GraphNodeKind
  isRecent: boolean
  preview: string
  title: string
}

const RECENT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

export function buildGraphNodeVisuals(
  graph: NoteGraphData,
  workspaceNodes: AppNode[],
  selectedNoteId: string | null,
  now = Date.now(),
): Map<string, GraphNodeVisual> {
  const noteById = new Map(workspaceNodes
    .filter((node) => node.type === 'note' && typeof node.content === 'string')
    .map((node) => [node.id, node]))
  const noteIdByGraphId = new Map(graph.nodes.map((node) => [node.id, node.noteId]))
  const neighbors = new Map<string, Set<string>>()

  for (const link of graph.links) {
    const sourceNoteId = noteIdByGraphId.get(link.source)
    const targetNoteId = noteIdByGraphId.get(link.target)
    if (!sourceNoteId || !targetNoteId) {
      continue
    }
    addNeighbor(neighbors, sourceNoteId, targetNoteId)
    addNeighbor(neighbors, targetNoteId, sourceNoteId)
  }

  const visuals = new Map<string, GraphNodeVisual>()
  for (const node of graph.nodes) {
    const note = noteById.get(node.noteId)
    const neighborCount = neighbors.get(node.noteId)?.size ?? 0
    const updatedAt = note ? Date.parse(note.updatedAt) : 0
    const isRecent = Number.isFinite(updatedAt) && now - updatedAt <= RECENT_WINDOW_MS
    const kind: GraphNodeKind = node.noteId === selectedNoteId
      ? 'active'
      : neighborCount === 0 || node.degree === 0
        ? 'orphan'
        : neighborCount >= 3 || node.degree >= 3
          ? 'bridge'
          : 'normal'

    visuals.set(node.noteId, {
      kind,
      isRecent,
      preview: note && typeof note.content === 'string' ? previewFromContent(note.content) : 'Sin contenido todavia.',
      title: note?.title ?? node.label,
    })
  }

  return visuals
}

function addNeighbor(map: Map<string, Set<string>>, sourceId: string, targetId: string) {
  const current = map.get(sourceId) ?? new Set<string>()
  current.add(targetId)
  map.set(sourceId, current)
}
