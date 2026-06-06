import { expect, type Page } from '@playwright/test'

export const adminEmail = 'admin@example.com'
export const adminPassword = 'password123'

export async function ensureSignedIn(page: Page): Promise<void> {
  await page.goto('/')

  const setupHeading = page.getByRole('heading', { name: 'Configurar Trace' })
  if (await setupHeading.isVisible().catch(() => false)) {
    await page.getByLabel('Workspace').fill('Trace E2E')
    await page.getByLabel('Email').fill(adminEmail)
    await page.getByLabel('Contrasena').fill(adminPassword)
    await page.getByRole('button', { name: 'Crear workspace' }).click()
    await expect(newNoteButton(page)).toBeVisible()
    return
  }

  const loginHeading = page.getByRole('heading', { name: 'Entrar a Trace' })
  if (await loginHeading.isVisible().catch(() => false)) {
    await page.getByLabel('Email').fill(adminEmail)
    await page.getByLabel('Contrasena').fill(adminPassword)
    await page.getByRole('button', { name: 'Entrar' }).click()
  }

  await expect(newNoteButton(page)).toBeVisible()
}

export function newNoteButton(page: Page) {
  return page.getByRole('complementary').getByRole('button', { name: 'Nueva nota' })
}

export async function accessToken(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('No se pudo refrescar token E2E')
    }
    const body = await response.json() as { token?: unknown }
    if (typeof body.token !== 'string') {
      throw new Error('Refresh E2E no devolvio token')
    }
    return body.token
  })
}
