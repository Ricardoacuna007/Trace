import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileText, GitBranch, LogIn, Plus, RefreshCw, Save, Trash2, Upload } from 'lucide-react'
import type { AppNode } from '../types/workspace'
import type { NoteGraphData } from '../features/notes-graph/graph'

type AuthMode = 'loading' | 'setup' | 'login' | 'app'

interface AuthResponse {
  token: string
  userId: string
}

interface SetupStatusResponse {
  setup_required: boolean
}

interface RestoreResponse {
  restored: boolean
}

interface DeletedResponse {
  deleted: boolean
}

interface FormState {
  workspaceName: string
  email: string
  password: string
}

interface DraftState {
  title: string
  body: string
  tags: string
}

const TOKEN_KEY = 'trace.selfhost.token'
const EMPTY_GRAPH: NoteGraphData = { nodes: [], links: [] }
const DEFAULT_DRAFT: DraftState = { title: '', body: '', tags: '' }

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

function extractInlineText(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    output.push(value)
    return
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      extractInlineText(item, output)
    }
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  const record = value as Record<string, unknown>
  if (typeof record.text === 'string') {
    output.push(record.text)
  }

  for (const key of Object.keys(record)) {
    if (key !== 'text') {
      extractInlineText(record[key], output)
    }
  }
}

function contentToText(content: string | undefined): string {
  if (!content) {
    return ''
  }

  try {
    const parsed = JSON.parse(content) as unknown
    const output: string[] = []
    extractInlineText(parsed, output)
    return output.join('\n').trim()
  } catch {
    return ''
  }
}

function textToContent(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n')
  return JSON.stringify(
    lines.map((line) => ({
      type: 'paragraph',
      content: line
        ? [{ type: 'text', text: line, styles: {} }]
        : [],
    })),
  )
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, '').toLowerCase())
        .filter(Boolean),
    ),
  )
}

function noteToDraft(note: AppNode | null): DraftState {
  if (!note) {
    return DEFAULT_DRAFT
  }

  return {
    title: note.title,
    body: contentToText(note.content),
    tags: note.tags?.join(', ') ?? '',
  }
}

export function TraceWebApp() {
  const restoreInputRef = useRef<HTMLInputElement | null>(null)
  const [mode, setMode] = useState<AuthMode>('loading')
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) ?? '')
  const [form, setForm] = useState<FormState>({
    workspaceName: 'Trace',
    email: '',
    password: '',
  })
  const selectedNoteIdRef = useRef<string | null>(null)
  const [notes, setNotes] = useState<AppNode[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftState>(DEFAULT_DRAFT)
  const [graph, setGraph] = useState<NoteGraphData>(EMPTY_GRAPH)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  )

  const selectNoteId = useCallback((noteId: string | null) => {
    selectedNoteIdRef.current = noteId
    setSelectedNoteId(noteId)
  }, [])

  const loadWorkspace = useCallback(async (nextToken = token) => {
    if (!nextToken) {
      setMode('login')
      return
    }

    try {
      const [nextNotes, nextGraph] = await Promise.all([
        fetch('/api/notes', { headers: authHeaders(nextToken) }).then((response) => readJson<AppNode[]>(response)),
        fetch('/api/graph', { headers: authHeaders(nextToken) }).then((response) => readJson<NoteGraphData>(response)),
      ])
      setNotes(nextNotes)
      setGraph(nextGraph)
      const currentSelectedId = selectedNoteIdRef.current
      const nextSelectedId = currentSelectedId && nextNotes.some((note) => note.id === currentSelectedId)
        ? currentSelectedId
        : nextNotes[0]?.id ?? null
      selectNoteId(nextSelectedId)
      setDraft(noteToDraft(nextNotes.find((note) => note.id === nextSelectedId) ?? null))
      setMode('app')
      setMessage(null)
    } catch {
      window.localStorage.removeItem(TOKEN_KEY)
      setToken('')
      setMode('login')
    }
  }, [selectNoteId, token])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const status = await fetch('/api/setup/status').then((response) => readJson<SetupStatusResponse>(response))
        if (cancelled) {
          return
        }
        if (status.setup_required) {
          setMode('setup')
          return
        }
        await loadWorkspace(token)
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : 'No se pudo iniciar Trace web')
          setMode('login')
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadWorkspace, token])

  const submitAuth = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const isSetup = mode === 'setup'
      const response = await fetch(isSetup ? '/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSetup
          ? { workspace_name: form.workspaceName, email: form.email, password: form.password }
          : { email: form.email, password: form.password }),
      }).then((item) => readJson<AuthResponse>(item))

      window.localStorage.setItem(TOKEN_KEY, response.token)
      setToken(response.token)
      await loadWorkspace(response.token)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo autenticar')
    } finally {
      setBusy(false)
    }
  }, [form.email, form.password, form.workspaceName, loadWorkspace, mode])

  const createNote = useCallback(async () => {
    if (!token) {
      return
    }

    setBusy(true)
    try {
      const note = await fetch('/api/notes', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', content: '[]', tags: [] }),
      }).then((response) => readJson<AppNode>(response))
      setNotes((current) => [note, ...current])
      selectNoteId(note.id)
      setDraft(noteToDraft(note))
      setMessage('Nota creada')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear nota')
    } finally {
      setBusy(false)
    }
  }, [selectNoteId, token])

  const saveNote = useCallback(async () => {
    if (!token || !selectedNote) {
      return
    }

    setBusy(true)
    try {
      const updated = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          content: textToContent(draft.body),
          tags: parseTags(draft.tags),
        }),
      }).then((response) => readJson<AppNode>(response))
      setNotes((current) => current.map((note) => (note.id === updated.id ? updated : note)))
      setMessage('Guardado')
      await loadWorkspace(token)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }, [draft.body, draft.tags, draft.title, loadWorkspace, selectedNote, token])

  const deleteSelectedNote = useCallback(async () => {
    if (!token || !selectedNote || !window.confirm(`Eliminar "${selectedNote.title}"?`)) {
      return
    }

    setBusy(true)
    try {
      await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }).then((response) => readJson<DeletedResponse>(response))
      const nextNotes = notes.filter((note) => note.id !== selectedNote.id)
      setNotes(nextNotes)
      const nextSelected = nextNotes[0] ?? null
      selectNoteId(nextSelected?.id ?? null)
      setDraft(noteToDraft(nextSelected))
      setMessage('Nota eliminada')
      await loadWorkspace(token)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }, [loadWorkspace, notes, selectNoteId, selectedNote, token])

  const downloadBackup = useCallback(async () => {
    if (!token) {
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/backup', { method: 'POST', headers: authHeaders(token) })
      if (!response.ok) {
        throw new Error(await response.text())
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `trace-backup-${Date.now()}.zip`
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Backup listo')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo generar backup')
    } finally {
      setBusy(false)
    }
  }, [token])

  const restoreBackup = useCallback(async (file: File | null) => {
    if (!token || !file) {
      return
    }

    setBusy(true)
    try {
      await fetch('/api/restore', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/zip' },
        body: file,
      }).then((response) => readJson<RestoreResponse>(response))
      setMessage('Backup restaurado')
      await loadWorkspace(token)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo restaurar')
    } finally {
      setBusy(false)
    }
  }, [loadWorkspace, token])

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setMode('login')
    setNotes([])
    selectNoteId(null)
  }, [selectNoteId])

  if (mode === 'loading') {
    return <div className="flex h-full items-center justify-center bg-bg text-sm text-t2">Cargando Trace...</div>
  }

  if (mode === 'setup' || mode === 'login') {
    return (
      <main className="flex h-full items-center justify-center bg-bg px-6 text-t1">
        <section className="w-full max-w-sm rounded-[var(--radius-lg)] border border-border bg-bg2 p-5 shadow-2xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-glow)] text-accent">
              <LogIn size={17} />
            </div>
            <div>
              <h1 className="text-lg font-medium">{mode === 'setup' ? 'Configurar Trace' : 'Entrar a Trace'}</h1>
              <p className="font-mono text-[11px] text-t3">self-host / local-first</p>
            </div>
          </div>

          <div className="space-y-3">
            {mode === 'setup' && (
              <label className="block text-xs text-t2">
                Workspace
                <input
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-t1 outline-none focus:border-accent"
                  value={form.workspaceName}
                  onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))}
                />
              </label>
            )}
            <label className="block text-xs text-t2">
              Email
              <input
                className="mt-1 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-t1 outline-none focus:border-accent"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="block text-xs text-t2">
              Contrasena
              <input
                type="password"
                className="mt-1 w-full rounded-[var(--radius-md)] border border-border bg-bg px-3 py-2 text-sm text-t1 outline-none focus:border-accent"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void submitAuth()
                  }
                }}
              />
            </label>
          </div>

          {message && <p className="mt-3 text-xs text-red">{message}</p>}

          <button
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent2 disabled:opacity-60"
            disabled={busy}
            onClick={() => void submitAuth()}
          >
            <LogIn size={15} />
            {mode === 'setup' ? 'Crear workspace' : 'Entrar'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="flex h-full overflow-hidden bg-bg text-t1">
      <aside className="flex w-[260px] shrink-0 flex-col border-r border-border bg-bg2">
        <div className="flex h-[38px] items-center justify-between border-b border-border px-3">
          <div className="font-mono text-[11px] text-t3">Trace / web</div>
          <button className="text-xs text-t2 hover:text-t1" onClick={logout}>Salir</button>
        </div>
        <div className="flex items-center gap-2 border-b border-border p-3">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent2 disabled:opacity-60"
            disabled={busy}
            onClick={() => void createNote()}
          >
            <Plus size={15} />
            Nueva nota
          </button>
          <button
            aria-label="Recargar"
            className="rounded-[var(--radius-md)] border border-border bg-bg3 p-2 text-t2 hover:text-t1"
            onClick={() => void loadWorkspace(token)}
          >
            <RefreshCw size={15} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {notes.map((note) => (
            <button
              key={note.id}
              className={`mb-1 flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-2 text-left text-sm transition-colors ${
                note.id === selectedNoteId
                  ? 'bg-[var(--accent-glow)] text-accent'
                  : 'text-t2 hover:bg-bg3 hover:text-t1'
              }`}
              onClick={() => {
                selectNoteId(note.id)
                setDraft(noteToDraft(note))
              }}
            >
              <FileText size={15} />
              <span className="min-w-0 flex-1 truncate">{note.title}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2 border-t border-border p-3">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg3 px-3 py-2 text-xs text-t2 hover:text-t1"
            onClick={() => void downloadBackup()}
          >
            <Download size={14} />
            Backup
          </button>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg3 px-3 py-2 text-xs text-t2 hover:text-t1"
            onClick={() => restoreInputRef.current?.click()}
          >
            <Upload size={14} />
            Restore
          </button>
          <input
            ref={restoreInputRef}
            className="hidden"
            type="file"
            accept=".zip,application/zip"
            onChange={(event) => void restoreBackup(event.target.files?.[0] ?? null)}
          />
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[38px] items-center justify-between border-b border-border bg-bg px-4">
          <div className="font-mono text-[11px] text-t3">
            {notes.length} notas / {graph.links.length} conexiones
          </div>
          {message && <div className="text-xs text-t2">{message}</div>}
        </header>

        {selectedNote ? (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_240px]">
            <article className="min-w-0 overflow-y-auto px-12 py-8">
              <input
                className="mb-2 w-full bg-transparent text-[28px] font-light text-t1 outline-none"
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                className="mb-5 w-full bg-transparent font-mono text-[11px] text-t3 outline-none"
                value={draft.tags}
                onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                placeholder="tags separados por coma"
              />
              <textarea
                className="min-h-[55vh] w-full resize-none bg-transparent text-[15px] leading-7 text-t1 outline-none"
                value={draft.body}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
              <div className="mt-5 flex gap-2">
                <button
                  className="flex items-center gap-2 rounded-[var(--radius-md)] bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent2 disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void saveNote()}
                >
                  <Save size={15} />
                  Guardar
                </button>
                <button
                  className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-bg2 px-3 py-2 text-sm text-red hover:border-red/40"
                  disabled={busy}
                  onClick={() => void deleteSelectedNote()}
                >
                  <Trash2 size={15} />
                  Eliminar
                </button>
              </div>
            </article>

            <aside className="border-l border-border bg-bg2 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm text-t1">
                <GitBranch size={15} className="text-accent" />
                Grafo
              </div>
              <div className="space-y-2 font-mono text-[11px] text-t3">
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Nodos</span>
                  <span>{graph.nodes.length}</span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span>Conexiones</span>
                  <span>{graph.links.length}</span>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-t3">
            Selecciona o crea una nota.
          </div>
        )}
      </section>
    </main>
  )
}
