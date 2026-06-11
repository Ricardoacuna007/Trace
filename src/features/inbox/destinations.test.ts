import { describe, expect, it } from 'vitest'
import type { NoteRelation } from '../../store/types'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'
import { suggestInboxDestinations } from './destinations'

function node(id: string, title: string, type: AppNode['type'], parentId: string | null = null): AppNode {
  return {
    id,
    title,
    type,
    parentId,
    content: type === 'note' ? '[]' : undefined,
    inbox: false,
    position: 0,
    updatedAt: '2026-06-11T12:00:00.000Z',
  }
}

function note(id: string, title: string, text: string, parentId: string | null, inbox = false): Note {
  return {
    ...node(id, title, 'note', parentId),
    type: 'note',
    content: JSON.stringify([{ type: 'paragraph', content: [{ type: 'text', text }] }]),
    inbox,
  }
}

describe('suggestInboxDestinations', () => {
  it('ranks folders by related note suggestions', () => {
    const workspace = node('workspace', 'Trace', 'workspace')
    const server = node('folder-server', 'Servidor', 'folder', workspace.id)
    const editor = node('folder-editor', 'Editor', 'folder', workspace.id)
    const inbox = note('inbox', 'Docker deploy', 'docker server compose self host', null, true)
    const serverNote = note('server-note', 'Docker server', 'docker compose self host backup', server.id)
    const editorNote = note('editor-note', 'Editor layout', 'layout theme typography', editor.id)
    const relations: NoteRelation[] = []

    const destinations = suggestInboxDestinations(inbox, [
      workspace,
      server,
      editor,
      inbox,
      serverNote,
      editorNote,
    ], relations)

    expect(destinations[0]).toMatchObject({
      id: server.id,
      title: 'Servidor',
      relatedCount: 1,
    })
    expect(destinations.map((destination) => destination.id)).toContain(workspace.id)
  })

  it('does not suggest destinations for non-inbox notes', () => {
    expect(suggestInboxDestinations(
      note('regular', 'Regular', 'content', 'workspace', false),
      [node('workspace', 'Trace', 'workspace')],
      [],
    )).toEqual([])
  })
})
