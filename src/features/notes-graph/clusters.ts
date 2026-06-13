import type { AppNode } from '../../types/workspace'
import { previewFromContent } from '../notes-editor/contentMetrics'
import type { NoteGraphData } from './graph'

export interface GraphClusterNote {
  id: string
  title: string
  preview: string
}

export interface GraphCluster {
  id: string
  label: string
  labelKey: string
  color: string
  noteIds: string[]
  graphNodeIds: string[]
  notes: GraphClusterNote[]
}

const CLUSTER_COLORS = [
  '#5e8bff',
  '#4ade80',
  '#f59e0b',
  '#f87171',
  '#a78bfa',
  '#22d3ee',
]

const STOP_WORDS = new Set([
  'about',
  'como',
  'con',
  'daily',
  'desde',
  'esta',
  'este',
  'into',
  'nota',
  'notas',
  'para',
  'sobre',
  'that',
  'the',
  'this',
  'trace',
  'una',
  'untitled',
])

function addEdge(map: Map<string, Set<string>>, sourceId: string, targetId: string) {
  const current = map.get(sourceId) ?? new Set<string>()
  current.add(targetId)
  map.set(sourceId, current)
}

function normalizeWord(value: string): string {
  const safeValue = typeof value.normalize === 'function' ? value.normalize('NFD') : value
  return safeValue
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function inferClusterLabel(notes: GraphClusterNote[]): string {
  const counts = new Map<string, number>()

  for (const note of notes) {
    const words = `${note.title} ${note.preview}`
      .split(/\s+/)
      .map(normalizeWord)
      .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))

    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1)
    }
  }

  const best = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) {
      return b[1] - a[1]
    }
    return a[0].localeCompare(b[0])
  })[0]?.[0]

  if (best) {
    return best
  }

  return notes[0]?.title ?? 'Cluster'
}

export function buildGraphClusters(
  graph: NoteGraphData,
  workspaceNodes: AppNode[],
  colors: string[] = CLUSTER_COLORS,
  labels: Record<string, string> = {},
): GraphCluster[] {
  const palette = colors.length > 0 ? colors : CLUSTER_COLORS
  const graphNodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const graphNodeIdByNoteId = new Map(graph.nodes.map((node) => [node.noteId, node.id]))
  const noteById = new Map(workspaceNodes
    .filter((node) => node.type === 'note' && typeof node.content === 'string')
    .map((node) => [node.id, node]))
  const adjacency = new Map<string, Set<string>>()

  for (const node of graph.nodes) {
    adjacency.set(node.noteId, new Set<string>())
  }

  for (const link of graph.links) {
    const source = graphNodeById.get(link.source)
    const target = graphNodeById.get(link.target)
    if (!source || !target) {
      continue
    }
    addEdge(adjacency, source.noteId, target.noteId)
    addEdge(adjacency, target.noteId, source.noteId)
  }

  const visited = new Set<string>()
  const clusters: GraphCluster[] = []

  for (const node of graph.nodes) {
    if (visited.has(node.noteId)) {
      continue
    }

    const stack = [node.noteId]
    const noteIds: string[] = []
    visited.add(node.noteId)

    while (stack.length > 0) {
      const current = stack.pop()
      if (!current) {
        continue
      }
      noteIds.push(current)

      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) {
          continue
        }
        visited.add(neighbor)
        stack.push(neighbor)
      }
    }

    if (noteIds.length < 2) {
      continue
    }

    const sortedNoteIds = noteIds.sort((a, b) => a.localeCompare(b))
    const notes = sortedNoteIds.map((noteId) => {
      const note = noteById.get(noteId)
      return {
        id: noteId,
        title: note?.title ?? graph.nodes.find((graphNode) => graphNode.noteId === noteId)?.label ?? 'Nota',
        preview: note?.content ? previewFromContent(note.content) : '',
      }
    })

    const index = clusters.length
    const labelKey = sortedNoteIds.join('|')
    const customLabel = labels[labelKey]?.trim()
    clusters.push({
      id: `cluster-${labelKey}`,
      label: customLabel || inferClusterLabel(notes),
      labelKey,
      color: palette[index % palette.length],
      noteIds: sortedNoteIds,
      graphNodeIds: sortedNoteIds
        .map((noteId) => graphNodeIdByNoteId.get(noteId))
        .filter((graphNodeId): graphNodeId is string => typeof graphNodeId === 'string'),
      notes,
    })
  }

  return clusters
}
