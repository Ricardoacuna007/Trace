import { expect, test } from '@playwright/test'
import { apiAccessToken } from './helpers'

test('downloads a backup and restores it with explicit confirmation', async ({ request }) => {
  const token = await apiAccessToken(request)

  const backupResponse = await request.post('/api/backup', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  expect(backupResponse.ok()).toBe(true)
  expect(backupResponse.headers()['content-type']).toContain('application/zip')
  const backup = await backupResponse.body()
  expect(backup.byteLength).toBeGreaterThan(0)

  const previewResponse = await request.post('/api/restore/preview', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
    },
    data: backup,
  })
  expect(previewResponse.ok()).toBe(true)
  const preview = await previewResponse.json() as { notes: number; sizeBytes: number }
  expect(preview.sizeBytes).toBe(backup.byteLength)

  const restoreResponse = await request.post('/api/restore', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
    },
    data: backup,
  })
  expect(restoreResponse.ok()).toBe(true)
  const restore = await restoreResponse.json() as { restored: boolean }
  expect(restore.restored).toBe(true)

  const historyResponse = await request.get('/api/backup/history', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  expect(historyResponse.ok()).toBe(true)
  const history = await historyResponse.json() as unknown[]
  expect(history.length).toBeGreaterThan(0)
})
