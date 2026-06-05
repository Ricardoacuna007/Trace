import { expect, test } from '@playwright/test'
import { adminEmail, adminPassword, ensureSignedIn, newNoteButton } from './helpers'

test('setup, login, logout and expired browser session', async ({ context, page }) => {
  await ensureSignedIn(page)

  await page.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar a Trace' })).toBeVisible()

  await page.getByLabel('Email').fill(adminEmail)
  await page.getByLabel('Contrasena').fill(adminPassword)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(newNoteButton(page)).toBeVisible()

  await context.clearCookies()
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Entrar a Trace' })).toBeVisible()
})
