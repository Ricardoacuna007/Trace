import type { NoteBacklink } from '../../lib/db'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'

export interface HeadingItem {
  id: string
  level: 1 | 2 | 3
  text: string
}

export interface BacklinkViewItem {
  sourceId: string
  title: string
  preview: string
  updatedAt?: string
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function extractInlineText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') {
        return item
      }
      const record = readRecord(item)
      if (!record) {
        return ''
      }
      if (typeof record.text === 'string') {
        return record.text
      }
      return extractInlineText(record.content)
    }).join('')
  }

  return ''
}

function parseBlocks(content: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed
      .map((block) => readRecord(block))
      .filter((block): block is Record<string, unknown> => block !== null)
  } catch {
    return []
  }
}

export function plainTextFromContent(content: string): string {
  return parseBlocks(content)
    .map((block) => extractInlineText(block.content).trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

export function countWords(content: string): number {
  const text = plainTextFromContent(content)
  if (!text.trim()) {
    return 0
  }
  return text.trim().split(/\s+/).length
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 220))
}

export function previewFromContent(content: string): string {
  const text = plainTextFromContent(content).replace(/\s+/g, ' ').trim()
  return text.length > 0 ? text.slice(0, 140) : 'Sin contenido todavia.'
}

export function extractHeadings(content: string): HeadingItem[] {
  return parseBlocks(content)
    .map((block, index) => {
      if (block.type !== 'heading') {
        return null
      }
      const props = readRecord(block.props)
      const rawLevel = props?.level
      const level = rawLevel === 2 || rawLevel === 3 ? rawLevel : 1
      const text = extractInlineText(block.content).trim()
      if (!text) {
        return null
      }
      return {
        id: `heading-${index}`,
        level,
        text,
      } satisfies HeadingItem
    })
    .filter((heading): heading is HeadingItem => heading !== null)
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) {
    return 'sin fecha'
  }

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return 'sin fecha'
  }

  const diffMs = Date.now() - timestamp
  const minutes = Math.max(0, Math.round(diffMs / 60_000))
  if (minutes < 1) {
    return 'ahora'
  }
  if (minutes < 60) {
    return `hace ${minutes}m`
  }
  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `hace ${hours}h`
  }
  const days = Math.round(hours / 24)
  if (days < 30) {
    return `hace ${days}d`
  }
  const months = Math.round(days / 30)
  return `hace ${months}mo`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return 'Sin fecha'
  }
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return 'Sin fecha'
  }
  return new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(timestamp)
}

export function buildBacklinkItems(
  noteId: string,
  nodes: AppNode[],
  relations: NoteRelation[],
  fetchedBacklinks: NoteBacklink[],
): BacklinkViewItem[] {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const fetchedById = new Map(fetchedBacklinks.map((backlink) => [backlink.sourceId, backlink]))
  const sourceIds = new Set(relations
    .filter((relation) => relation.targetId === noteId)
    .map((relation) => relation.sourceId))

  for (const backlink of fetchedBacklinks) {
    sourceIds.add(backlink.sourceId)
  }

  const items: Array<BacklinkViewItem | null> = Array.from(sourceIds)
    .map((sourceId) => {
      const fetched = fetchedById.get(sourceId)
      if (fetched) {
        return {
          sourceId,
          title: fetched.title,
          preview: fetched.preview,
          updatedAt: fetched.updatedAt,
        } satisfies BacklinkViewItem
      }

      const source = byId.get(sourceId)
      if (!source || source.type !== 'note' || typeof source.content !== 'string') {
        return null
      }

      return {
        sourceId,
        title: source.title,
        preview: previewFromContent(source.content),
        updatedAt: source.updatedAt,
      } satisfies BacklinkViewItem
    })

  return items
    .filter((item): item is BacklinkViewItem => item !== null)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

export function findNote(nodes: AppNode[], noteId: string | null): Note | null {
  if (!noteId) {
    return null
  }
  const node = nodes.find((item) => item.id === noteId)
  if (!node || node.type !== 'note' || typeof node.content !== 'string') {
    return null
  }
  return { ...node, type: 'note', content: node.content }
}
