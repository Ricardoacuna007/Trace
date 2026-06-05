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
    const token = await loginViaApi(page)
    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token, user_id: 'e2e-admin' }),
      })
    })
    await page.goto('/')
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

async function loginViaApi(page: Page): Promise<string> {
  const response = await page.request.post('/api/auth/login', {
    data: {
      email: adminEmail,
      password: adminPassword,
    },
  })
  expect(response.ok()).toBe(true)
  const body = await response.json() as { token?: unknown }
  if (typeof body.token !== 'string') {
    throw new Error('Login API E2E no devolvio token')
  }
  const setCookie = response.headers()['set-cookie']
  const cookiePair = setCookie?.split(';')[0]
  const [name, value] = cookiePair?.split('=') ?? []
  if (!name || !value) {
    throw new Error('Login API E2E no devolvio cookie de refresh')
  }
  await page.context().addCookies([{
    name,
    value,
    url: 'http://127.0.0.1:18080/api/auth/refresh',
    httpOnly: true,
    sameSite: 'Lax',
    secure: false,
  }])
  return body.token
}
