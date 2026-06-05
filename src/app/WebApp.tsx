import type { Block } from '@blocknote/core'
import { LogIn } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NoteGraphData } from '../features/notes-graph/graph'
import { previewFromContent } from '../features/notes-editor/contentMetrics'
import type { NoteBacklink, TraceUIModules } from '../lib/db'
import { withTree } from '../lib/workspace/nodeTree'
import type { AppViewMode, NoteRelation, SaveStatus, ViewMode } from '../store/types'
import type { Note } from '../types/note'
import type { AppNode } from '../types/workspace'
import { AppErrorBanner } from './shell/AppErrorBanner'
import { AppLoading } from './shell/AppLoading'
import { AppShell } from './shell/AppShell'
import { CommandPalette } from './shell/CommandPalette'
import { ThemeInjector } from './shell/ThemeInjector'

type AuthMode = 'loading' | 'setup' | 'login' | 'app'

interface AuthResponse {
  token: string
  user_id: string
}

interface SetupStatusResponse {
  setup_required: boolean
}

interface FormState {
  workspaceName: string
  email: string
  password: string
}

const TOKEN_KEY = 'trace.selfhost.token'
const DEFAULT_TRACE_CONFIG_JSON = '{}'
const EMPTY_GRAPH: NoteGraphData = { nodes: [], links: [] }
const DEFAULT_UI_MODULES: TraceUIModules = {
  show_breadcrumbs: true,
  show_backlinks: true,
  show_node_icons: true,
  enable_autosave: true,
}

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

function isNote(node: AppNode | undefined): node is Note {
  return Boolean(node && node.type === 'note' && typeof node.content === 'string')
}

function updatedNow(): string {
  return new Date().toISOString()
}

function buildBacklinks(noteId: string | null, nodes: AppNode[], relations: NoteRelation[]): NoteBacklink[] {
  if (!noteId) {
    return []
  }

  return relations
    .filter((relation) => relation.targetId === noteId)
    .map((relation) => {
      const source = nodes.find((node) => node.id === relation.sourceId)
      if (!source) {
        return null
      }
      return {
        sourceId: source.id,
        title: source.title,
        preview: typeof source.content === 'string' ? previewFromContent(source.content) : '',
        updatedAt: source.updatedAt,
      } satisfies NoteBacklink
    })
    .filter((backlink): backlink is NoteBacklink => backlink !== null)
}

function blocksToContent(blocks: Block[]): string {
  return JSON.stringify(blocks)
}

export function WebApp() {
  const saveTimerRef = useRef<number | null>(null)
  const queuedNoteRef = useRef<Note | null>(null)
  const [mode, setMode] = useState<AuthMode>('loading')
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_KEY) ?? '')
  const [form, setForm] = useState<FormState>({
    workspaceName: 'Trace',
    email: '',
    password: '',
  })
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [relations, setRelations] = useState<NoteRelation[]>([])
  const [graphData, setGraphData] = useState<NoteGraphData>(EMPTY_GRAPH)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<AppViewMode>('workspace')
  const [viewMode, setViewMode] = useState<ViewMode>('workspace')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [pinnedNoteIds, setPinnedNoteIds] = useState<string[]>([])
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { nodeTree } = useMemo(() => withTree(nodes), [nodes])
  const selectedNote = useMemo(
    () => {
      const selected = nodes.find((node) => node.id === selectedNodeId)
      return isNote(selected) ? selected : null
    },
    [nodes, selectedNodeId],
  )
  const breadcrumbs = useMemo(
    () => (selectedNote ? [selectedNote] : []),
    [selectedNote],
  )
  const backlinks = useMemo(
    () => buildBacklinks(selectedNote?.id ?? null, nodes, relations),
    [nodes, relations, selectedNote?.id],
  )

  const loadWorkspace = useCallback(async (nextToken = token) => {
    if (!nextToken) {
      setMode('login')
      return
    }

    try {
      const [nextNotes, nextRelations, nextGraph] = await Promise.all([
        fetch('/api/notes', { headers: authHeaders(nextToken) }).then((response) => readJson<AppNode[]>(response)),
        fetch('/api/relations', { headers: authHeaders(nextToken) }).then((response) => readJson<NoteRelation[]>(response)),
        fetch('/api/graph', { headers: authHeaders(nextToken) }).then((response) => readJson<NoteGraphData>(response)),
      ])
      setNodes(nextNotes)
      setRelations(nextRelations)
      setGraphData(nextGraph)
      setSelectedNodeId((current) => (
        current && nextNotes.some((note) => note.id === current)
          ? current
          : nextNotes[0]?.id ?? null
      ))
      setActiveView(nextNotes.length > 0 ? 'editor' : 'workspace')
      setViewMode(nextNotes.length > 0 ? 'editor' : 'workspace')
      setMode('app')
      setMessage(null)
    } catch (error) {
      window.localStorage.removeItem(TOKEN_KEY)
      setToken('')
      setMode('login')
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar el workspace')
    }
  }, [token])

  const persistQueuedNote = useCallback(async (note: Note, nextToken = token) => {
    if (!nextToken) {
      return
    }
    setSaveStatus('saving')
    try {
      const updated = await fetch(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { ...authHeaders(nextToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          parentId: note.parentId,
          tags: note.tags ?? [],
        }),
      }).then((response) => readJson<AppNode>(response))
      setNodes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSaveStatus('saved')
      setMessage('Guardado')
    } catch (error) {
      setSaveStatus('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar')
    }
  }, [token])

  const queuePersistNote = useCallback((note: Note) => {
    queuedNoteRef.current = note
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }
    setSaveStatus('saving')
    saveTimerRef.current = window.setTimeout(() => {
      const queued = queuedNoteRef.current
      if (queued) {
        void persistQueuedNote(queued)
      }
    }, 650)
  }, [persistQueuedNote])

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
          setMode('login')
          setMessage(error instanceof Error ? error.message : 'No se pudo iniciar Trace web')
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    }
  }, [loadWorkspace, token])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const submitAuth = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const isSetup = mode === 'setup'
      const auth = await fetch(isSetup ? '/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSetup
          ? { workspace_name: form.workspaceName, email: form.email, password: form.password }
          : { email: form.email, password: form.password }),
      }).then((response) => readJson<AuthResponse>(response))

      window.localStorage.setItem(TOKEN_KEY, auth.token)
      setToken(auth.token)
      await loadWorkspace(auth.token)
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
      setNodes((current) => [note, ...current])
      setSelectedNodeId(note.id)
      setActiveView('editor')
      setViewMode('editor')
      setMessage('Nota creada')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear nota')
    } finally {
      setBusy(false)
    }
  }, [token])

  const updateSelectedNote = useCallback((updater: (note: Note) => Note) => {
    const currentNote = selectedNote
    if (!currentNote) {
      return
    }
    const updated = updater(currentNote)
    setNodes((current) => current.map((node) => (node.id === updated.id ? updated : node)))
    queuePersistNote(updated)
  }, [queuePersistNote, selectedNote])

  const handleContentChange = useCallback((noteId: string, blocks: Block[]) => {
    if (selectedNote?.id !== noteId) {
      return
    }
    updateSelectedNote((note) => ({
      ...note,
      content: blocksToContent(blocks),
      updatedAt: updatedNow(),
    }))
  }, [selectedNote?.id, updateSelectedNote])

  const handleTitleChange = useCallback((noteId: string, title: string) => {
    if (selectedNote?.id !== noteId) {
      return
    }
    updateSelectedNote((note) => ({
      ...note,
      title,
      updatedAt: updatedNow(),
    }))
  }, [selectedNote?.id, updateSelectedNote])

  const selectNode = useCallback((id: string) => {
    setSelectedNodeId(id)
    setActiveView('editor')
    setViewMode('editor')
  }, [])

  const openWikiLink = useCallback(async (title: string) => {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      return
    }
    const existing = nodes.find((node) => (
      node.type === 'note' && node.title.trim().toLowerCase() === normalizedTitle.toLowerCase()
    ))
    if (existing) {
      selectNode(existing.id)
      return
    }
    if (!token) {
      return
    }
    const note = await fetch('/api/notes', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: normalizedTitle, content: '[]', tags: [] }),
    }).then((response) => readJson<AppNode>(response))
    setNodes((current) => [note, ...current])
    selectNode(note.id)
  }, [nodes, selectNode, token])

  const pinNote = useCallback((noteId: string) => {
    setPinnedNoteIds((current) => current.includes(noteId) ? current : [...current, noteId])
  }, [])

  const unpinNote = useCallback((noteId: string) => {
    setPinnedNoteIds((current) => current.filter((id) => id !== noteId))
  }, [])

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setNodes([])
    setRelations([])
    setSelectedNodeId(null)
    setMode('login')
  }, [])

  if (mode === 'loading') {
    return <AppLoading configJson={DEFAULT_TRACE_CONFIG_JSON} customCss="" />
  }

  if (mode === 'setup' || mode === 'login') {
    return (
      <main className="flex h-full items-center justify-center bg-[var(--bg)] px-6 text-[var(--t1)]">
        <ThemeInjector configJson={DEFAULT_TRACE_CONFIG_JSON} customCss="" />
        <section className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-5 shadow-2xl">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-glow)] text-[var(--accent)]">
              <LogIn size={17} />
            </div>
            <div>
              <h1 className="text-lg font-medium">{mode === 'setup' ? 'Configurar Trace' : 'Entrar a Trace'}</h1>
              <p className="font-mono text-[11px] text-[var(--t3)]">self-host / local-first</p>
            </div>
          </div>

          <div className="space-y-3">
            {mode === 'setup' ? (
              <label className="block text-xs text-[var(--t2)]">
                Workspace
                <input
                  className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--t1)] outline-none focus:border-[var(--accent)]"
                  value={form.workspaceName}
                  onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))}
                />
              </label>
            ) : null}
            <label className="block text-xs text-[var(--t2)]">
              Email
              <input
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--t1)] outline-none focus:border-[var(--accent)]"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </label>
            <label className="block text-xs text-[var(--t2)]">
              Contrasena
              <input
                type="password"
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--t1)] outline-none focus:border-[var(--accent)]"
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

          {message ? <p className="mt-3 text-xs text-[var(--red)]">{message}</p> : null}

          <button
            type="button"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent2)] disabled:opacity-60"
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
    <main className="flex h-full flex-col">
      <ThemeInjector configJson={DEFAULT_TRACE_CONFIG_JSON} customCss="" />
      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        activeNoteId={selectedNote?.id ?? null}
        nodes={nodes}
        onOpenChange={setCommandOpen}
        onQueryChange={setCommandQuery}
        onOpenNote={selectNode}
        onCreateFolder={() => setMessage('Las carpetas web se agregaran en una version posterior.')}
        onCreateNote={() => void createNote()}
        onSwitchView={(modeName) => {
          if (modeName === 'settings' || modeName === 'database') {
            setViewMode(modeName)
            return
          }
          setActiveView(modeName)
          setViewMode(modeName)
        }}
        onOpenConnect={() => setMessage('Conectar notas desde web se agregara al flujo unificado.')}
        onOpenSettings={() => setViewMode('settings')}
        onExportMarkdown={() => setMessage('Exportar Markdown desde web se agregara despues.')}
      />
      <AppErrorBanner error={message} />
      <AppShell
        activeVaultPath="Trace Web"
        activeView={activeView}
        backlinks={backlinks}
        breadcrumbs={breadcrumbs}
        customCss=""
        customizationLoading={false}
        customizationSaving={false}
        editorWidth="centered"
        graphData={graphData}
        hasPendingChanges={saveStatus === 'saving'}
        isBacklinksPanelOpen
        ioMessage={message}
        ioWorking={busy}
        isPropertiesPanelOpen
        isSidebarOpen
        markdownDbLoading={false}
        markdownDbSnapshot={null}
        nodeTree={nodeTree}
        nodes={nodes}
        noteRelations={relations}
        pinnedNoteIds={pinnedNoteIds}
        recentConnectionIds={[]}
        renderConnectModal={false}
        saveStatus={saveStatus}
        selectedNodeId={selectedNodeId}
        selectedNote={selectedNote}
        traceConfigJson={DEFAULT_TRACE_CONFIG_JSON}
        traceDir={null}
        uiModules={DEFAULT_UI_MODULES}
        viewMode={viewMode}
        onContentChange={handleContentChange}
        onCreateFolder={() => setMessage('Las carpetas web se agregaran en una version posterior.')}
        onCreateNote={() => void createNote()}
        onExportCurrentNoteMarkdown={() => setMessage('Exportar Markdown desde web se agregara despues.')}
        onExportVaultMarkdown={() => setMessage('Exportar vault desde web se agregara despues.')}
        onImportMarkdown={() => setMessage('Importar Markdown desde web se agregara despues.')}
        onOpenCommandPalette={() => setCommandOpen(true)}
        onOpenConnectModal={() => setMessage('Conectar notas desde web se agregara al flujo unificado.')}
        onOpenNode={selectNode}
        onOpenNodeFromGraph={selectNode}
        onOpenWikiLink={(title) => void openWikiLink(title)}
        onPinNote={pinNote}
        onRefreshMarkdownDatabase={() => setMessage('La base Markdown local solo esta disponible en desktop.')}
        onReloadCustomization={() => setMessage('La personalizacion por vault local solo esta disponible en desktop.')}
        onSaveCustomization={() => setMessage('La personalizacion por vault local solo esta disponible en desktop.')}
        onSetActiveView={(nextView) => {
          setActiveView(nextView)
          setViewMode(nextView)
        }}
        onSetEditorWidth={() => setMessage('El ancho del editor web se configurara en settings self-host.')}
        onTitleChange={handleTitleChange}
        onToggleModule={() => setMessage('Los modulos UI web se configuraran en settings self-host.')}
        onUnpinNote={unpinNote}
        onPrintCurrentNote={() => window.print()}
        onUpdateMarkdownProperty={() => setMessage('La base Markdown local solo esta disponible en desktop.')}
      />
      <button
        type="button"
        onClick={logout}
        className="fixed bottom-3 right-3 z-40 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-[11px] text-[var(--t2)] shadow-xl hover:text-[var(--t1)]"
      >
        Salir
      </button>
    </main>
  )
}
