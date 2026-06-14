import type { Block } from '@blocknote/core'
import { LogIn } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NoteGraphData } from '../features/notes-graph/graph'
import { previewFromContent } from '../features/notes-editor/contentMetrics'
import { clearAccessToken, setAccessToken } from '../lib/auth'
import {
  parseTraceConfig,
  type NoteBacklink,
  type TraceConfig,
} from '../lib/db'
import { apiFetch, apiJson, readJson, refreshAccessToken } from '../lib/http'
import { withTree } from '../lib/workspace/nodeTree'
import type { AppViewMode, NoteRelation, SaveStatus, ViewMode } from '../store/types'
import type { Note } from '../types/note'
import type { AppNode } from '../types/workspace'
import { AppErrorBanner } from './shell/AppErrorBanner'
import { AppLoading } from './shell/AppLoading'
import { AppShell } from './shell/AppShell'
import { CommandPalette } from './shell/CommandPalette'
import { ThemeInjector } from './shell/ThemeInjector'
import { WebConnectNoteModal } from './WebConnectNoteModal'
import { WebSettings } from './WebSettings'

type AuthMode = 'loading' | 'setup' | 'login' | 'app'

interface AuthResponse {
  token: string
  user_id: string
}

interface SetupStatusResponse {
  setup_required: boolean
}

interface ImportSummary {
  workspaceId: string
  workspaceTitle: string
  importedNotes: number
  createdRelations: number
}

interface WebCustomization {
  traceDir: string
  configJson: string
  customCss: string
}

interface FormState {
  workspaceName: string
  email: string
  password: string
}

const DEFAULT_TRACE_CONFIG_JSON = '{}'
const EMPTY_GRAPH: NoteGraphData = { nodes: [], links: [] }

function toEditorWidthMode(value: string): 'full' | 'centered' {
  return value === 'full' ? 'full' : 'centered'
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

function relationKey(relation: NoteRelation): string {
  return `${relation.sourceId}->${relation.targetId}`
}

function mergeRelations(current: NoteRelation[], incoming: NoteRelation[]): NoteRelation[] {
  const seen = new Set<string>()
  const merged: NoteRelation[] = []
  for (const relation of [...current, ...incoming]) {
    const key = relationKey(relation)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    merged.push(relation)
  }
  return merged
}

export function WebApp() {
  const saveTimerRef = useRef<number | null>(null)
  const queuedNoteRef = useRef<Note | null>(null)
  const importMarkdownInputRef = useRef<HTMLInputElement | null>(null)
  const [path, setPath] = useState(() => window.location.pathname)
  const [mode, setMode] = useState<AuthMode>('loading')
  const [form, setForm] = useState<FormState>({
    workspaceName: 'Trace',
    email: '',
    password: '',
  })
  const [nodes, setNodes] = useState<AppNode[]>([])
  const [relations, setRelations] = useState<NoteRelation[]>([])
  const [ignoredSuggestionPairs, setIgnoredSuggestionPairs] = useState<string[]>([])
  const [graphData, setGraphData] = useState<NoteGraphData>(EMPTY_GRAPH)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<AppViewMode>('workspace')
  const [viewMode, setViewMode] = useState<ViewMode>('workspace')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [pinnedNoteIds, setPinnedNoteIds] = useState<string[]>([])
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [propertiesPanelOpen, setPropertiesPanelOpen] = useState(true)
  const [webConnectOpen, setWebConnectOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [webConfigJson, setWebConfigJson] = useState(DEFAULT_TRACE_CONFIG_JSON)
  const [webCustomCss, setWebCustomCss] = useState('')
  const [webTraceDir, setWebTraceDir] = useState<string | null>(null)
  const [customizationLoading, setCustomizationLoading] = useState(false)
  const [customizationSaving, setCustomizationSaving] = useState(false)

  const { nodeTree } = useMemo(() => withTree(nodes), [nodes])
  const traceConfig = useMemo(() => parseTraceConfig(webConfigJson), [webConfigJson])
  const editorWidth = useMemo(() => toEditorWidthMode(traceConfig.editor_width), [traceConfig.editor_width])
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

  const loadCustomization = useCallback(async () => {
    setCustomizationLoading(true)
    try {
      const customization = await apiJson<WebCustomization>('/api/customization')
      setWebTraceDir(customization.traceDir || 'server_settings')
      setWebConfigJson(customization.configJson || DEFAULT_TRACE_CONFIG_JSON)
      setWebCustomCss(customization.customCss ?? '')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar personalizacion web')
    } finally {
      setCustomizationLoading(false)
    }
  }, [])

  const saveWebCustomization = useCallback(async (configJson: string, customCss: string, options?: { silent?: boolean }) => {
    const parsed = parseTraceConfig(configJson)
    const nextConfigJson = JSON.stringify(parsed, null, 2)

    setCustomizationSaving(true)
    setWebConfigJson(nextConfigJson)
    setWebCustomCss(customCss)
    try {
      const customization = await apiJson<WebCustomization>('/api/customization', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configJson: nextConfigJson, customCss }),
      })
      setWebTraceDir(customization.traceDir || 'server_settings')
      setWebConfigJson(customization.configJson || nextConfigJson)
      setWebCustomCss(customization.customCss ?? customCss)
      if (!options?.silent) {
        setMessage('Personalizacion guardada')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar personalizacion web')
    } finally {
      setCustomizationSaving(false)
    }
  }, [])

  const persistWebConfigUpdate = useCallback(async (updater: (config: TraceConfig) => TraceConfig) => {
    const nextConfig = updater(parseTraceConfig(webConfigJson || DEFAULT_TRACE_CONFIG_JSON))
    await saveWebCustomization(JSON.stringify(nextConfig, null, 2), webCustomCss, { silent: true })
  }, [saveWebCustomization, webConfigJson, webCustomCss])

  const loadWorkspace = useCallback(async () => {
    try {
      const [nextNotes, nextRelations, nextGraph] = await Promise.all([
        apiJson<AppNode[]>('/api/nodes'),
        apiJson<NoteRelation[]>('/api/relations'),
        apiJson<NoteGraphData>('/api/graph'),
      ])
      const nextIgnored = await apiJson<NoteRelation[]>('/api/suggestions/ignored').catch(() => [])
      setNodes(nextNotes)
      setRelations(nextRelations)
      setIgnoredSuggestionPairs(nextIgnored.map(relationKey))
      setGraphData(nextGraph)
      setSelectedNodeId((current) => (
        current && nextNotes.some((note) => note.id === current)
          ? current
          : nextNotes[0]?.id ?? null
      ))
      setActiveView(nextNotes.length > 0 ? 'editor' : 'workspace')
      setViewMode(nextNotes.length > 0 ? 'editor' : 'workspace')
      await loadCustomization()
      setMode('app')
      setMessage(null)
    } catch (error) {
      clearAccessToken()
      setMode('login')
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar el workspace')
    }
  }, [loadCustomization])

  const persistQueuedNote = useCallback(async (note: Note) => {
    setSaveStatus('saving')
    try {
      const updated = await apiJson<AppNode>(`/api/notes/${note.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          parentId: note.parentId,
          tags: note.tags ?? [],
        }),
      })
      setNodes((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSaveStatus('saved')
      setMessage('Guardado')
    } catch (error) {
      setSaveStatus('error')
      setMessage(error instanceof Error ? error.message : 'No se pudo guardar')
    }
  }, [])

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
        const refreshed = await refreshAccessToken()
        if (!refreshed) {
          setMode('login')
          return
        }
        await loadWorkspace()
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
  }, [loadWorkspace])

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((nextPath: string) => {
    window.history.pushState(null, '', nextPath)
    setPath(nextPath)
  }, [])

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
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSetup
          ? { workspace_name: form.workspaceName, email: form.email, password: form.password }
          : { email: form.email, password: form.password }),
      }).then((response) => readJson<AuthResponse>(response))

      setAccessToken(auth.token)
      await loadWorkspace()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo autenticar')
    } finally {
      setBusy(false)
    }
  }, [form.email, form.password, form.workspaceName, loadWorkspace, mode])

  const createNote = useCallback(async () => {
    setBusy(true)
    try {
      const note = await apiJson<AppNode>('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', content: '[]', tags: [] }),
      })
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
  }, [])

  const createFolder = useCallback(async () => {
    setBusy(true)
    try {
      const folder = await apiJson<AppNode>('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Nueva carpeta' }),
      })
      setNodes((current) => [folder, ...current])
      setSelectedNodeId(folder.id)
      setActiveView('workspace')
      setViewMode('workspace')
      setMessage('Carpeta creada')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear carpeta')
    } finally {
      setBusy(false)
    }
  }, [])

  const connectNotes = useCallback(async (sourceId: string, targetIds: string[]) => {
    const targets = Array.from(new Set(targetIds.filter((targetId) => targetId && targetId !== sourceId)))
    if (targets.length === 0) {
      return
    }

    try {
      const created = await apiJson<NoteRelation[]>('/api/relations/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetIds: targets }),
      })
      setRelations((current) => mergeRelations(current, created))
      const nextGraph = await apiJson<NoteGraphData>('/api/graph')
      setGraphData(nextGraph)
      setMessage(targets.length === 1 ? 'Nota conectada' : `${targets.length} notas conectadas`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron conectar notas')
    }
  }, [])

  const disconnectNotes = useCallback(async (sourceId: string, targetId: string) => {
    try {
      const removed = await apiJson<NoteRelation[]>('/api/relations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      })
      const removedKeys = new Set(removed.map(relationKey))
      setRelations((current) => current.filter((relation) => !removedKeys.has(relationKey(relation))))
      const nextGraph = await apiJson<NoteGraphData>('/api/graph')
      setGraphData(nextGraph)
      setMessage('Conexion eliminada')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo desconectar la nota')
    }
  }, [])

  const ignoreConnectionSuggestion = useCallback(async (sourceId: string, targetId: string) => {
    try {
      const ignored = await apiJson<NoteRelation[]>('/api/suggestions/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId }),
      })
      setIgnoredSuggestionPairs((current) => Array.from(new Set([
        ...current,
        ...ignored.map(relationKey),
      ])))
      setMessage('Sugerencia ignorada')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo ignorar sugerencia')
    }
  }, [])

  const downloadHttpResponse = useCallback(async (response: Response, fallbackFilename: string) => {
    if (!response.ok) {
      throw new Error(await responseErrorMessage(response))
    }

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = downloadFilename(response.headers.get('content-disposition'), fallbackFilename)
    link.click()
    URL.revokeObjectURL(objectUrl)
  }, [])

  const exportCurrentNoteMarkdown = useCallback(async () => {
    if (!selectedNote) {
      setMessage('Selecciona una nota para exportar.')
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      const response = await apiFetch(`/api/export/note/${encodeURIComponent(selectedNote.id)}`)
      await downloadHttpResponse(response, `${safeDownloadName(selectedNote.title)}.md`)
      setMessage('Nota exportada en Markdown')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo exportar la nota')
    } finally {
      setBusy(false)
    }
  }, [downloadHttpResponse, selectedNote])

  const exportVaultMarkdown = useCallback(async () => {
    setBusy(true)
    setMessage(null)
    try {
      const response = await apiFetch('/api/export/vault')
      await downloadHttpResponse(response, 'trace-markdown.zip')
      setMessage('Vault exportado en Markdown')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo exportar el vault')
    } finally {
      setBusy(false)
    }
  }, [downloadHttpResponse])

  const triggerImportMarkdown = useCallback(() => {
    importMarkdownInputRef.current?.click()
  }, [])

  const importMarkdownZip = useCallback(async (file: File) => {
    setBusy(true)
    setMessage(null)
    try {
      const summary = await apiJson<ImportSummary>('/api/import/markdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/zip' },
        body: file,
      })
      await loadWorkspace()
      setMessage(`Importacion completada: ${summary.importedNotes} notas y ${summary.createdRelations} relaciones.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo importar Markdown')
    } finally {
      setBusy(false)
    }
  }, [loadWorkspace])

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
    const note = await apiJson<AppNode>('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: normalizedTitle, content: '[]', tags: [] }),
    })
    setNodes((current) => [note, ...current])
    selectNode(note.id)
  }, [nodes, selectNode])

  const pinNote = useCallback((noteId: string) => {
    setPinnedNoteIds((current) => current.includes(noteId) ? current : [...current, noteId])
  }, [])

  const unpinNote = useCallback((noteId: string) => {
    setPinnedNoteIds((current) => current.filter((id) => id !== noteId))
  }, [])

  const logout = useCallback(() => {
    void fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    clearAccessToken()
    setNodes([])
    setRelations([])
    setIgnoredSuggestionPairs([])
    setSelectedNodeId(null)
    setMode('login')
    navigate('/')
  }, [navigate])

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

  if (path === '/settings') {
    return (
      <main className="flex h-full flex-col">
        <ThemeInjector configJson={webConfigJson} customCss={webCustomCss} />
        <WebSettings onBack={() => navigate('/')} onLogout={logout} />
      </main>
    )
  }

  return (
    <main className="flex h-full flex-col">
      <ThemeInjector configJson={webConfigJson} customCss={webCustomCss} />
      <CommandPalette
        open={commandOpen}
        query={commandQuery}
        activeNoteId={selectedNote?.id ?? null}
        nodes={nodes}
        onOpenChange={setCommandOpen}
        onQueryChange={setCommandQuery}
        onOpenNote={selectNode}
        onCreateFolder={() => void createFolder()}
        onCreateNote={() => void createNote()}
        onSwitchView={(modeName) => {
          if (modeName === 'settings' || modeName === 'database') {
            if (modeName === 'settings') {
              navigate('/settings')
              return
            }
            setViewMode(modeName)
            return
          }
          setActiveView(modeName)
          setViewMode(modeName)
        }}
        onOpenConnect={() => setWebConnectOpen(true)}
        onOpenSettings={() => navigate('/settings')}
        onExportMarkdown={() => {
          if (selectedNote) {
            void exportCurrentNoteMarkdown()
            return
          }
          void exportVaultMarkdown()
        }}
      />
      <AppErrorBanner error={message} />
      <input
        ref={importMarkdownInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) {
            void importMarkdownZip(file)
          }
        }}
      />
      {webConnectOpen ? (
        <WebConnectNoteModal
          activeNote={selectedNote}
          notes={nodes}
          noteRelations={relations}
          open={webConnectOpen}
          onClose={() => setWebConnectOpen(false)}
          onConnectNotes={(sourceId, targetIds) => void connectNotes(sourceId, targetIds)}
        />
      ) : null}
      <AppShell
        activeVaultPath="Trace Web"
        activeView={activeView}
        backlinks={backlinks}
        breadcrumbs={breadcrumbs}
        customCss={webCustomCss}
        customizationLoading={customizationLoading}
        customizationSaving={customizationSaving}
        editorWidth={editorWidth}
        graphData={graphData}
        hasPendingChanges={saveStatus === 'saving'}
        ignoredSuggestionPairs={ignoredSuggestionPairs}
        isBacklinksPanelOpen
        ioMessage={message}
        ioWorking={busy}
        isPropertiesPanelOpen={propertiesPanelOpen}
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
        traceConfigJson={webConfigJson}
        traceDir={webTraceDir}
        traceTheme={traceConfig.theme}
        traceAccentColor={traceConfig.accent_color}
        traceFontFamily={traceConfig.font_family}
        traceCodeRunnerSettings={traceConfig.code_runner}
        traceEditorSettings={traceConfig.editor}
        traceGraphSettings={traceConfig.graph}
        traceLayout={traceConfig.layout}
        uiModules={traceConfig.ui_modules}
        viewMode={viewMode}
        onContentChange={handleContentChange}
        onConnectNotes={(sourceId, targetIds) => void connectNotes(sourceId, targetIds)}
        onDisconnectNotes={(sourceId, targetId) => void disconnectNotes(sourceId, targetId)}
        onIgnoreConnectionSuggestion={(sourceId, targetId) => void ignoreConnectionSuggestion(sourceId, targetId)}
        onMoveNode={() => setMessage('Procesar bandeja desde web se agregara al flujo unificado.')}
        onCreateFolder={() => void createFolder()}
        onCreateNote={() => void createNote()}
        onExportCurrentNoteMarkdown={() => void exportCurrentNoteMarkdown()}
        onExportVaultMarkdown={() => void exportVaultMarkdown()}
        onImportMarkdown={triggerImportMarkdown}
        onOpenCommandPalette={() => setCommandOpen(true)}
        onOpenConnectModal={() => setWebConnectOpen(true)}
        onOpenNode={selectNode}
        onOpenNodeFromGraph={selectNode}
        onOpenWikiLink={(title) => void openWikiLink(title)}
        onPinNote={pinNote}
        onRefreshMarkdownDatabase={() => setMessage('La base Markdown local solo esta disponible en desktop.')}
        onReloadCustomization={() => void loadCustomization()}
        onSaveCustomization={(configJson, customCss) => void saveWebCustomization(configJson, customCss)}
        onSetActiveView={(nextView) => {
          setActiveView(nextView)
          setViewMode(nextView)
        }}
        onSetEditorWidth={(width) => void persistWebConfigUpdate((config) => ({ ...config, editor_width: width }))}
        onUpdateTraceAppearance={(patch) => {
          void persistWebConfigUpdate((config) => ({
            ...config,
            theme: patch.theme ?? config.theme,
            accent_color: patch.accent_color ?? config.accent_color,
            font_family: patch.font_family ?? config.font_family,
          }))
        }}
        onUpdateTraceCodeRunnerSettings={(patch) => {
          void persistWebConfigUpdate((config) => ({
            ...config,
            code_runner: {
              ...config.code_runner,
              ...patch,
            },
          }))
        }}
        onUpdateTraceEditorSettings={(patch) => {
          void persistWebConfigUpdate((config) => ({
            ...config,
            editor: {
              ...config.editor,
              ...patch,
            },
          }))
        }}
        onUpdateTraceGraphSettings={(patch) => {
          void persistWebConfigUpdate((config) => ({
            ...config,
            graph: {
              ...config.graph,
              ...patch,
            },
          }))
        }}
        onUpdateTraceLayout={(layout) => {
          setPropertiesPanelOpen(layout.right_panel === 'visible')
          void persistWebConfigUpdate((config) => ({
            ...config,
            layout,
          }))
        }}
        onTitleChange={handleTitleChange}
        onToggleModule={(module, enabled) => {
          void persistWebConfigUpdate((config) => ({
            ...config,
            ui_modules: {
              ...config.ui_modules,
              [module]: enabled,
            },
          }))
        }}
        onTogglePropertiesPanel={() => setPropertiesPanelOpen((open) => !open)}
        onUnpinNote={unpinNote}
        onPrintCurrentNote={() => window.print()}
        onUpdateMarkdownProperty={() => setMessage('La base Markdown local solo esta disponible en desktop.')}
        onReloadWorkspace={loadWorkspace}
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

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text()
  if (!text.trim()) {
    return `HTTP ${response.status}`
  }

  try {
    const parsed = JSON.parse(text) as { error?: unknown }
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error
    }
  } catch {
    return text
  }

  return text
}

function downloadFilename(contentDisposition: string | null, fallback: string): string {
  const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1]
  return filename?.trim() || fallback
}

function safeDownloadName(value: string): string {
  const cleaned = Array.from(value.trim())
    .map((char) => {
      const invalid = '<>:"/\\|?*'.includes(char) || char.charCodeAt(0) < 32
      return invalid ? '_' : char
    })
    .join('')
    .replace(/^\.+|\.+$/g, '')

  return cleaned || 'untitled'
}
