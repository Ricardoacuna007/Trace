import { expect, test } from '@playwright/test'
import { ensureSignedIn } from './helpers'

test('downloads a backup and restores it with explicit confirmation', async ({ page }) => {
  await ensureSignedIn(page)
  await page.goto('/settings')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar backup' }).click()
  const download = await downloadPromise
  const backupPath = await download.path()
  expect(backupPath).toBeTruthy()

  await page.locator('input[type="file"]').setInputFiles(backupPath ?? '')
  await expect(page.getByText(/Este backup tiene/)).toBeVisible()

  const confirmInput = page.getByPlaceholder('Escribe RESTORE')
  await confirmInput.fill('RESTORE')
  await expect(confirmInput).toHaveValue('RESTORE')
  const restoreButton = page.getByRole('button', { name: 'Restaurar' })
  await expect(restoreButton).toBeEnabled()
  await restoreButton.click()
  await expect(page.getByText('Backup restaurado')).toBeVisible()
})
