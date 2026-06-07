import { isTauri } from '../../lib/env'
import type { AppNode } from '../../types/workspace'

const GENERIC_TITLES = new Set(['untitled'])

export type GraphComputeMode = 'rust' | 'js'

export interface NoteGraphNode {
  id: string
  noteId: string
  label: string
  degree: number
}

export interface NoteGraphLink {
  id: string
  source: string
  target: string
  weight: number
}

export interface NoteGraphData {
  nodes: NoteGraphNode[]
  links: NoteGraphLink[]
}

export const EMPTY_GRAPH: NoteGraphData = { nodes: [], links: [] }

interface NoteLike {
  id: string
  title: string
  content: string
}

export interface ExplicitNoteRelation {
  sourceId: string
  targetId: string
}

function normalizeText(value: string): string {
  const safeValue = typeof value.normalize === 'function' ? value.normalize('NFD') : value
  const ascii = safeValue
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return ascii
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectTextDeep(value: unknown, collector: string[]): void {
  if (!value) {
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextDeep(item, collector)
    }
    return
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const maybeText = record.text
    if (typeof maybeText === 'string') {
      collector.push(maybeText)
    }

    for (const key of Object.keys(record)) {
      if (key === 'text') {
        continue
      }
      collectTextDeep(record[key], collector)
    }
  }
}

function extractNoteText(content: string): string {
  try {
    const parsed = JSON.parse(content)
    const collector: string[] = []
    collectTextDeep(parsed, collector)
    return normalizeText(collector.join(' '))
  } catch {
    return ''
  }
}

function sanitizeGraphData(graph: unknown): NoteGraphData {
  if (!graph || typeof graph !== 'object') {
    return EMPTY_GRAPH
  }

  const raw = graph as { nodes?: unknown; links?: unknown }
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes : []
  const rawLinks = Array.isArray(raw.links) ? raw.links : []

  const nodes = rawNodes
    .map((node) => {
      if (!node || typeof node !== 'object') {
        return null
      }
      const record = node as Record<string, unknown>
      const id = record.id
      const noteId = record.noteId
      const label = record.label
      const degree = record.degree

      if (
        typeof id !== 'string' ||
        typeof noteId !== 'string' ||
        typeof label !== 'string' ||
        typeof degree !== 'number'
      ) {
        return null
      }

      return { id, noteId, label, degree } satisfies NoteGraphNode
    })
    .filter((node): node is NoteGraphNode => node !== null)

  const nodeIds = new Set(nodes.map((node) => node.id))
  const links = rawLinks
    .map((link) => {
      if (!link || typeof link !== 'object') {
        return null
      }
      const record = link as Record<string, unknown>
      const id = record.id
      const source = record.source
      const target = record.target
      const weight = record.weight

      if (
        typeof id !== 'string' ||
        typeof source !== 'string' ||
        typeof target !== 'string' ||
        typeof weight !== 'number'
      ) {
        return null
      }

      if (!nodeIds.has(source) || !nodeIds.has(target)) {
        return null
      }

      return { id, source, target, weight } satisfies NoteGraphLink
    })
    .filter((link): link is NoteGraphLink => link !== null)

  return { nodes, links }
}

async function generateGraphDataRust(): Promise<NoteGraphData> {
  if (!isTauri()) {
    throw new Error('Rust graph command is only available inside Tauri.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const graph = await invoke<unknown>('generate_graph_data')
  return sanitizeGraphData(graph)
}

function toNotes(nodes: AppNode[]): NoteLike[] {
  return nodes
    .filter((node): node is AppNode & { type: 'note'; content: string } => (
      node.type === 'note' && typeof node.content === 'string' && !node.inbox
    ))
    .map((node) => ({
      id: node.id,
      title: node.title,
      content: node.content,
    }))
}

export function buildNoteGraph(nodesInput: AppNode[], explicitRelations: ExplicitNoteRelation[] = []): NoteGraphData {
  const notes = toNotes(nodesInput)
  const nodes: NoteGraphNode[] = notes.map((note) => ({
    id: `note-${note.id}`,
    noteId: note.id,
    label: note.title,
    degree: 0,
  }))

  const byId = new Map(nodes.map((node) => [node.noteId, node]))
  const normalizedTitles = new Map(notes.map((note) => [note.id, normalizeText(note.title).trim()]))
  const noteText = new Map(notes.map((note) => [note.id, extractNoteText(note.content)]))

  const links: NoteGraphLink[] = []
  const weightById = new Map<string, NoteGraphLink>()

  const upsertLink = (sourceId: string, targetId: string, weight: number) => {
    const id = `${sourceId}-${targetId}`
    const existing = weightById.get(id)
    if (existing) {
      existing.weight += weight
      return
    }

    const next: NoteGraphLink = {
      id,
      source: `note-${sourceId}`,
      target: `note-${targetId}`,
      weight,
    }
    weightById.set(id, next)
    links.push(next)
  }

  for (const source of notes) {
    const sourceText = noteText.get(source.id)
    if (!sourceText) {
      continue
    }

    for (const target of notes) {
      if (source.id === target.id) {
        continue
      }

      const targetTitle = normalizedTitles.get(target.id)
      if (!targetTitle || targetTitle.length < 2) {
        continue
      }
      if (GENERIC_TITLES.has(targetTitle)) {
        continue
      }

      const matches = sourceText.match(new RegExp(`\\b${escapeRegExp(targetTitle)}\\b`, 'g'))
      const weight = matches?.length ?? 0
      if (weight === 0) {
        continue
      }

      upsertLink(source.id, target.id, weight)
    }
  }

  for (const relation of explicitRelations) {
    if (relation.sourceId === relation.targetId) {
      continue
    }
    if (!byId.has(relation.sourceId) || !byId.has(relation.targetId)) {
      continue
    }
    upsertLink(relation.sourceId, relation.targetId, 1)
  }

  for (const link of links) {
    const sourceId = link.source.replace('note-', '')
    const targetId = link.target.replace('note-', '')

    const sourceNode = byId.get(sourceId)
    const targetNode = byId.get(targetId)
    if (sourceNode) {
      sourceNode.degree += link.weight
    }
    if (targetNode) {
      targetNode.degree += link.weight
    }
  }

  return { nodes, links }
}

export async function computeGraphData(
  nodes: AppNode[],
  preferredMode: GraphComputeMode,
  explicitRelations: ExplicitNoteRelation[] = [],
): Promise<{ graph: NoteGraphData; mode: GraphComputeMode }> {
  if (preferredMode === 'rust' && isTauri()) {
    try {
      const graph = await generateGraphDataRust()
      return { graph, mode: 'rust' }
    } catch {
      return { graph: buildNoteGraph(nodes, explicitRelations), mode: 'js' }
    }
  }

  return { graph: buildNoteGraph(nodes, explicitRelations), mode: 'js' }
}
