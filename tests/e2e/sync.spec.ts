import { expect, test } from '@playwright/test'
import { apiAccessToken } from './helpers'

test('pushes and pulls notes through the sync API', async ({ request }) => {
  const token = await apiAccessToken(request)
  const noteId = `note-e2e-sync-${Date.now()}`

  const pushResponse = await request.post('/api/sync/push', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      since: 0,
      notes: [{
        id: noteId,
        title: 'E2E synced note',
        type: 'note',
        parentId: null,
        content: '[]',
        icon: 'file-text',
        tags: [],
        position: 0,
        updatedAt: new Date().toISOString(),
      }],
    },
  })
  expect(pushResponse.ok()).toBe(true)
  const push = await pushResponse.json() as { accepted: string[]; conflicts: unknown[] }

  expect(push.accepted).toContain(noteId)
  expect(push.conflicts).toHaveLength(0)

  const pullResponse = await request.get('/api/sync/pull?since=0', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  expect(pullResponse.ok()).toBe(true)
  const pull = await pullResponse.json() as { notes: Array<{ id: string }> }

  expect(pull.notes.some((note) => note.id === noteId)).toBe(true)
})
