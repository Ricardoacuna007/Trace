import { describe, expect, it } from 'vitest'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import { pairKey, suggestConnections } from './suggestions'

function note(id: string, title: string, text: string): Note {
  return {
    id,
    title,
    type: 'note',
    parentId: null,
    content: JSON.stringify([{ type: 'paragraph', content: text }]),
    icon: 'file-text',
    tags: [],
    inbox: false,
    position: 0,
    updatedAt: '2026-06-06T00:00:00.000Z',
  }
}

describe('suggestConnections', () => {
  it('ranks notes with shared vocabulary higher', () => {
    const source = note('source', 'Trace server', 'Docker self host sqlite backup restore')
    const related = note('related', 'Self host backups', 'Docker compose backup restore sqlite vault')
    const unrelated = note('unrelated', 'Cooking', 'Pasta tomato basil')

    const suggestions = suggestConnections(source, [source, related, unrelated], [])

    expect(suggestions[0]?.note.id).toBe('related')
    expect(suggestions.map((suggestion) => suggestion.note.id)).not.toContain('unrelated')
  })

  it('does not suggest connected or ignored pairs', () => {
    const source = note('source', 'Graph', 'local graph cluster bridge')
    const connected = note('connected', 'Cluster bridge', 'graph bridge cluster')
    const ignored = note('ignored', 'Local graph', 'graph local')
    const relations: NoteRelation[] = [{ sourceId: 'source', targetId: 'connected' }]
    const nodes: AppNode[] = [source, connected, ignored]

    const suggestions = suggestConnections(source, nodes, relations, new Set([pairKey('source', 'ignored')]))

    expect(suggestions).toEqual([])
  })

  it('boosts notes mentioned by title', () => {
    const source = note('source', 'Capture', 'I need to revisit Refactor Plan today')
    const mentioned = note('mentioned', 'Refactor Plan', 'architecture notes')

    const suggestions = suggestConnections(source, [source, mentioned], [])

    expect(suggestions[0]?.note.id).toBe('mentioned')
  })
})
