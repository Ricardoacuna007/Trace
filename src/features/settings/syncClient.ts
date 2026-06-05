import type { Note } from '../../types/note'

export interface SyncConflict {
  noteId: string
  client: Note
  server: Note
}

export interface SyncPushResponse {
  accepted: string[]
  conflicts: SyncConflict[]
}

export interface SyncPullResponse {
  notes: Note[]
  serverTime: number
}

export interface SyncStatusResponse {
  lastPush: number | null
  lastPull: number | null
  lastSyncOk: number | null
  pendingConflicts: number
}

export class SyncHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'SyncHttpError'
    this.status = status
  }
}

export async function fetchSyncStatus(serverUrl: string, accessToken: string): Promise<SyncStatusResponse> {
  return requestJson<SyncStatusResponse>(serverUrl, '/api/sync/status', accessToken)
}

export async function pushNotesToServer(
  serverUrl: string,
  accessToken: string,
  notes: Note[],
  since: number,
): Promise<SyncPushResponse> {
  return requestJson<SyncPushResponse>(serverUrl, '/api/sync/push', accessToken, {
    method: 'POST',
    body: JSON.stringify({ notes, since }),
  })
}

export async function pullNotesFromServer(
  serverUrl: string,
  accessToken: string,
  since: number,
): Promise<SyncPullResponse> {
  return requestJson<SyncPullResponse>(serverUrl, `/api/sync/pull?since=${encodeURIComponent(String(since))}`, accessToken)
}

async function requestJson<T>(
  serverUrl: string,
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${normalizeServerUrl(serverUrl)}${path}`
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')

  if (init.body) {
    headers.set('Content-Type', 'application/json')
  }

  const trimmedToken = accessToken.trim()
  if (trimmedToken.length > 0) {
    headers.set('Authorization', `Bearer ${trimmedToken}`)
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    throw new SyncHttpError(response.status, await readErrorMessage(response))
  }

  return response.json() as Promise<T>
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown }
    if (typeof body.error === 'string' && body.error.trim().length > 0) {
      return body.error
    }
  } catch {
    // Fall back to the status text below.
  }
  return response.statusText || `HTTP ${response.status}`
}

function normalizeServerUrl(serverUrl: string): string {
  const trimmed = serverUrl.trim()
  if (trimmed.length === 0) {
    throw new SyncHttpError(0, 'Configura la URL del servidor')
  }
  return trimmed.replace(/\/+$/, '')
}
