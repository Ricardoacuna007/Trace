import { expect, test } from '@playwright/test'
import { newNoteButton, openAppWithApiSession } from './helpers'

test('creates and edits a note in the web UI', async ({ page }) => {
  await openAppWithApiSession(page)

  const title = `E2E Note ${Date.now()}`
  await newNoteButton(page).click()
  const titleInput = page.getByLabel(/T.tulo de nota/)
  await titleInput.fill(title)

  await expect(titleInput).toHaveValue(title)
  await expect(page.getByText(title).first()).toBeVisible()
})
