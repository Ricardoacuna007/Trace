import { describe, expect, it } from 'vitest'
import type { AppNode } from '../../types/workspace'
import type { NoteGraphData } from './graph'
import { buildGraphClusters } from './clusters'

function note(id: string, title: string, text: string): AppNode {
  return {
    id,
    title,
    type: 'note',
    parentId: null,
    content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }]),
    inbox: false,
    position: 0,
    updatedAt: '2026-06-11T12:00:00.000Z',
  }
}

describe('buildGraphClusters', () => {
  it('groups connected components and ignores orphan notes', () => {
    const graph: NoteGraphData = {
      nodes: [
        { id: 'note-a', noteId: 'a', label: 'Arquitectura servidor', degree: 1 },
        { id: 'note-b', noteId: 'b', label: 'Docker servidor', degree: 1 },
        { id: 'note-c', noteId: 'c', label: 'Editor BlockNote', degree: 1 },
        { id: 'note-d', noteId: 'd', label: 'Personalizacion editor', degree: 1 },
        { id: 'note-e', noteId: 'e', label: 'Idea suelta', degree: 0 },
      ],
      links: [
        { id: 'a-b', source: 'note-a', target: 'note-b', weight: 1 },
        { id: 'c-d', source: 'note-c', target: 'note-d', weight: 1 },
      ],
    }

    const clusters = buildGraphClusters(graph, [
      note('a', 'Arquitectura servidor', 'servidor docker self host'),
      note('b', 'Docker servidor', 'servidor compose release'),
      note('c', 'Editor BlockNote', 'editor notas escritura'),
      note('d', 'Personalizacion editor', 'editor tema layout'),
      note('e', 'Idea suelta', 'sin enlaces'),
    ])

    expect(clusters).toHaveLength(2)
    expect(clusters[0]).toMatchObject({
      label: 'servidor',
      noteIds: ['a', 'b'],
      graphNodeIds: ['note-a', 'note-b'],
    })
    expect(clusters[1]?.noteIds).toEqual(['c', 'd'])
    expect(clusters.flatMap((cluster) => cluster.noteIds)).not.toContain('e')
  })
})
