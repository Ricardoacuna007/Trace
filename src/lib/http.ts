import { clearAccessToken, getAccessToken, setAccessToken } from './auth'

interface AuthResponse {
  token: string
  user_id: string
}

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function refreshAccessToken(): Promise<string | null> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })

  if (!response.ok) {
    clearAccessToken()
    return null
  }

  const auth = await readJson<AuthResponse>(response)
  setAccessToken(auth.token)
  return auth.token
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

async function fetchWithAccessToken(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const response = await fetchWithAccessToken(input, init)
  if (response.status !== 401) {
    return response
  }

  const refreshed = await refreshAccessToken()
  if (!refreshed) {
    redirectToLogin()
    return response
  }

  return fetchWithAccessToken(input, init)
}

export async function apiJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  return apiFetch(input, init).then((response) => readJson<T>(response))
}
