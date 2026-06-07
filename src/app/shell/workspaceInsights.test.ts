import { describe, expect, it } from 'vitest'
import type { NoteRelation } from '../../store/types'
import type { AppNode } from '../../types/workspace'
import { buildWorkspaceInsights } from './workspaceInsights'

const NOW = Date.parse('2026-06-06T12:00:00.000Z')

function note(overrides: Partial<AppNode> = {}): AppNode {
  return {
    id: overrides.id ?? 'note-1',
    title: overrides.title ?? 'Note',
    type: 'note',
    parentId: null,
    content: overrides.content ?? JSON.stringify([{ type: 'paragraph', content: 'Trace note.' }]),
    icon: 'file-text',
    tags: [],
    inbox: false,
    position: 0,
    updatedAt: overrides.updatedAt ?? '2026-06-06T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildWorkspaceInsights', () => {
  it('excludes inbox notes from workspace insights', () => {
    const insights = buildWorkspaceInsights([
      note({ id: 'visible', title: 'Visible note' }),
      note({ id: 'inbox', title: 'Inbox note', inbox: true }),
    ], [], NOW)

    expect(insights.notes.map((item) => item.id)).toEqual(['visible'])
    expect(insights.lastSession?.id).toBe('visible')
  })

  it('detects unfinished notes from open checklist items', () => {
    const content = JSON.stringify([
      { type: 'checkListItem', props: { checked: false }, content: 'Ship quick capture' },
    ])
    const insights = buildWorkspaceInsights([note({ id: 'todo', content })], [], NOW)

    expect(insights.unfinished).toEqual([
      expect.objectContaining({
        reason: 'lista con pendientes abiertos',
        note: expect.objectContaining({ id: 'todo' }),
      }),
    ])
  })

  it('builds weekly activity and old note sections', () => {
    const relations: NoteRelation[] = [
      { sourceId: 'week', targetId: 'old' },
    ]
    const insights = buildWorkspaceInsights([
      note({
        id: 'week',
        title: 'This week',
        content: JSON.stringify([{ type: 'paragraph', content: 'one two three' }]),
        updatedAt: '2026-06-05T10:00:00.000Z',
      }),
      note({
        id: 'old',
        title: 'Old note',
        updatedAt: '2026-04-01T10:00:00.000Z',
      }),
    ], relations, NOW)

    expect(insights.weeklyActivity[0]).toEqual(expect.objectContaining({
      words: 3,
      connectionCount: 1,
    }))
    expect(insights.oldNote?.id).toBe('old')
  })
})
