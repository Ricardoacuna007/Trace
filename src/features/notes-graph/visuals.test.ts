import { describe, expect, it } from 'vitest'
import type { AppNode } from '../../types/workspace'
import type { NoteGraphData } from './graph'
import { buildGraphNodeVisuals } from './visuals'

const NOW = Date.parse('2026-06-11T12:00:00.000Z')

function note(id: string, updatedAt = '2026-06-10T12:00:00.000Z'): AppNode {
  return {
    id,
    title: `Note ${id}`,
    type: 'note',
    parentId: null,
    content: JSON.stringify([{ type: 'paragraph', content: `Preview ${id}` }]),
    inbox: false,
    position: 0,
    updatedAt,
  }
}

describe('buildGraphNodeVisuals', () => {
  it('marks selected, orphan, bridge, and recent nodes', () => {
    const graph: NoteGraphData = {
      nodes: [
        { id: 'note-a', noteId: 'a', label: 'A', degree: 3 },
        { id: 'note-b', noteId: 'b', label: 'B', degree: 1 },
        { id: 'note-c', noteId: 'c', label: 'C', degree: 1 },
        { id: 'note-d', noteId: 'd', label: 'D', degree: 1 },
        { id: 'note-e', noteId: 'e', label: 'E', degree: 0 },
      ],
      links: [
        { id: 'a-b', source: 'note-a', target: 'note-b', weight: 1 },
        { id: 'a-c', source: 'note-a', target: 'note-c', weight: 1 },
        { id: 'a-d', source: 'note-a', target: 'note-d', weight: 1 },
      ],
    }

    const visuals = buildGraphNodeVisuals(graph, [
      note('a'),
      note('b', '2026-01-01T00:00:00.000Z'),
      note('c'),
      note('d'),
      note('e'),
    ], 'b', NOW)

    expect(visuals.get('a')).toMatchObject({ kind: 'bridge', isRecent: true })
    expect(visuals.get('b')).toMatchObject({ kind: 'active', isRecent: false })
    expect(visuals.get('e')).toMatchObject({ kind: 'orphan', isRecent: true })
  })
})
