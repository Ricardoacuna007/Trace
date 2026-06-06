import { expect, type APIRequestContext, type Page } from '@playwright/test'

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
    const loginResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'))
    await page.getByRole('button', { name: 'Entrar' }).click()
    expect((await loginResponse).ok()).toBe(true)
  }

  await expect(newNoteButton(page)).toBeVisible()
}

export function newNoteButton(page: Page) {
  return page.getByRole('complementary').getByRole('button', { name: 'Nueva nota' })
}

interface SetupStatusResponse {
  setup_required?: unknown
}

interface AuthResponse {
  token?: unknown
}

export async function apiAccessToken(request: APIRequestContext): Promise<string> {
  const setupStatus = await request.get('/api/setup/status')
  expect(setupStatus.ok()).toBe(true)
  const statusBody = await setupStatus.json() as SetupStatusResponse
  const authResponse = statusBody.setup_required === true
    ? await request.post('/setup', {
      data: {
        workspace_name: 'Trace E2E',
        email: adminEmail,
        password: adminPassword,
      },
    })
    : await request.post('/api/auth/login', {
      data: {
        email: adminEmail,
        password: adminPassword,
      },
    })

  expect(authResponse.ok()).toBe(true)
  const authBody = await authResponse.json() as AuthResponse
  if (typeof authBody.token !== 'string') {
    throw new Error('Auth API E2E no devolvio token')
  }
  return authBody.token
}
