import { expect, test } from '@playwright/test'
import { accessToken, ensureSignedIn } from './helpers'

test('pushes and pulls notes through the sync API', async ({ page }) => {
  await ensureSignedIn(page)
  const token = await accessToken(page)
  const noteId = `note-e2e-sync-${Date.now()}`

  const push = await page.evaluate(async ({ noteId, token }) => {
    const response = await fetch('/api/sync/push', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    })
    return response.json() as Promise<{ accepted: string[]; conflicts: unknown[] }>
  }, { noteId, token })

  expect(push.accepted).toContain(noteId)
  expect(push.conflicts).toHaveLength(0)

  const pull = await page.evaluate(async (token) => {
    const response = await fetch('/api/sync/pull?since=0', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    return response.json() as Promise<{ notes: Array<{ id: string }> }>
  }, token)

  expect(pull.notes.some((note) => note.id === noteId)).toBe(true)
})
