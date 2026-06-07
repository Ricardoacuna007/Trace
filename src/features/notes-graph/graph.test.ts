import { describe, expect, it } from 'vitest'
import { buildNoteGraph } from './graph'
import type { AppNode } from '../../types/workspace'

function note(id: string, title: string, text: string): AppNode {
  return {
    id,
    title,
    type: 'note',
    parentId: 'workspace-1',
    content: JSON.stringify([
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ]),
    inbox: false,
    position: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('buildNoteGraph', () => {
  it('detects title mentions and explicit relations', () => {
    const graph = buildNoteGraph(
      [
        note('a', 'Alpha', 'Beta appears twice: beta.'),
        note('b', 'Beta', 'No outgoing mention.'),
        note('c', 'Gamma', ''),
      ],
      [{ sourceId: 'c', targetId: 'a' }],
    )

    expect(graph.nodes).toHaveLength(3)
    expect(graph.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'a-b', weight: 2 }),
        expect.objectContaining({ id: 'c-a', weight: 1 }),
      ]),
    )
  })

  it('normalizes accents when matching note titles', () => {
    const graph = buildNoteGraph([
      note('recipe', 'Crème brûlée', ''),
      note('journal', 'Daily note', 'Today I tested creme brulee.'),
    ])

    expect(graph.links).toEqual([
      expect.objectContaining({
        id: 'journal-recipe',
        source: 'note-journal',
        target: 'note-recipe',
        weight: 1,
      }),
    ])
  })

  it('ignores generic untitled notes as implicit link targets', () => {
    const graph = buildNoteGraph([
      note('untitled', 'Untitled', ''),
      note('source', 'Source', 'This mentions untitled, but should not link.'),
    ])

    expect(graph.links).toEqual([])
  })
})
