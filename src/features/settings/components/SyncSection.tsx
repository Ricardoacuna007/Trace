import { CheckCircle2, DownloadCloud, RefreshCw, ShieldAlert, UploadCloud, Wifi, WifiOff } from 'lucide-react'
import { useMemo, useState } from 'react'
import { upsertSyncedNote } from '../../../lib/db'
import { getAccessToken } from '../../../lib/auth'
import { isTauri } from '../../../lib/env'
import type { Note } from '../../../types/note'
import {
  fetchSyncStatus,
  pullNotesFromServer,
  pushNotesToServer,
  type SyncConflict,
  type SyncStatusResponse,
} from '../syncClient'

interface SyncSectionProps {
  notes: Note[]
  onReloadWorkspace: () => Promise<void>
}

type SyncState = 'idle' | 'connected' | 'disconnected'

const inputClassName = 'w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--t1)] outline-none transition-colors focus:border-[var(--accent)]'
const buttonClassName = 'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs font-medium text-[var(--t2)] transition-colors duration-150 ease-in-out hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60'
const primaryButtonClassName = 'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white transition-colors duration-150 ease-in-out hover:bg-[var(--accent2)] disabled:cursor-not-allowed disabled:opacity-60'

export function SyncSection({ notes, onReloadWorkspace }: SyncSectionProps) {
  const [serverUrl, setServerUrl] = useState('')
  const [accessToken, setAccessToken] = useState(() => getAccessToken() ?? '')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [status, setStatus] = useState<SyncStatusResponse | null>(null)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const notesReadyToPush = useMemo(() => {
    const since = status?.lastPush ?? 0
    return notes.filter((note) => toEpoch(note.updatedAt) > since)
  }, [notes, status?.lastPush])

  const canRun = serverUrl.trim().length > 0 && !working
  const connectionLabel = syncState === 'connected'
    ? 'Conectado'
    : syncState === 'disconnected'
      ? 'Sin conexion'
      : 'Sin verificar'

  async function refreshStatus(): Promise<SyncStatusResponse | null> {
    const nextStatus = await fetchSyncStatus(serverUrl, accessToken)
    setStatus(nextStatus)
    setSyncState('connected')
    return nextStatus
  }

  async function runAction(action: () => Promise<void>): Promise<void> {
    setWorking(true)
    setMessage(null)
    try {
      await action()
    } catch (error) {
      setSyncState('disconnected')
      setMessage(error instanceof Error ? error.message : 'No se pudo sincronizar')
    } finally {
      setWorking(false)
    }
  }

  function handleCheckStatus(): void {
    void runAction(async () => {
      await refreshStatus()
      setMessage('Servidor disponible')
    })
  }

  function handlePush(): void {
    void runAction(async () => {
      const since = status?.lastPush ?? 0
      const response = await pushNotesToServer(serverUrl, accessToken, notesReadyToPush, since)
      setConflicts(response.conflicts)
      await refreshStatus()
      setMessage(`${response.accepted.length} notas enviadas`)
    })
  }

  function handlePull(): void {
    void runAction(async () => {
      const since = status?.lastPull ?? 0
      const response = await pullNotesFromServer(serverUrl, accessToken, since)
      if (isTauri()) {
        for (const note of response.notes) {
          await upsertSyncedNote(note)
        }
        await onReloadWorkspace()
      }
      await refreshStatus()
      setMessage(`${response.notes.length} notas recibidas`)
    })
  }

  function keepDesktop(conflict: SyncConflict): void {
    void runAction(async () => {
      const response = await pushNotesToServer(serverUrl, accessToken, [
        { ...conflict.client, updatedAt: new Date().toISOString() },
      ], status?.lastPush ?? 0)
      setConflicts((current) => current.filter((item) => item.noteId !== conflict.noteId))
      await refreshStatus()
      setMessage(response.accepted.length > 0 ? 'Version desktop conservada' : 'No se pudo resolver el conflicto')
    })
  }

  function keepServer(conflict: SyncConflict): void {
    void runAction(async () => {
      if (isTauri()) {
        await upsertSyncedNote(conflict.server)
        await onReloadWorkspace()
      }
      setConflicts((current) => current.filter((item) => item.noteId !== conflict.noteId))
      setMessage('Version servidor conservada')
    })
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]">
            Sincronizacion
          </p>
          <p className="mt-1 text-xs text-[var(--t2)]">Push / pull self-host por HTTP</p>
        </div>
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[10px] ${
          syncState === 'connected'
            ? 'border-[rgba(74,222,128,0.28)] bg-[rgba(74,222,128,0.08)] text-[var(--green)]'
            : 'border-[var(--border)] bg-[var(--bg3)] text-[var(--t3)]'
        }`}>
          {syncState === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {connectionLabel}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.45fr)]">
        <label className="text-xs text-[var(--t2)]">
          Servidor
          <input
            className={`${inputClassName} mt-1`}
            placeholder="https://trace.midominio.com"
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
          />
        </label>
        <label className="text-xs text-[var(--t2)]">
          Token
          <input
            className={`${inputClassName} mt-1`}
            type="password"
            placeholder="Bearer token"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" className={buttonClassName} disabled={!canRun} onClick={handleCheckStatus}>
          <RefreshCw className="h-3.5 w-3.5" />
          Verificar
        </button>
        <button type="button" className={primaryButtonClassName} disabled={!canRun} onClick={handlePush}>
          <UploadCloud className="h-3.5 w-3.5" />
          Push servidor
        </button>
        <button type="button" className={buttonClassName} disabled={!canRun} onClick={handlePull}>
          <DownloadCloud className="h-3.5 w-3.5" />
          Pull servidor
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
        <Metric label="Ultimo push" value={formatTimestamp(status?.lastPush)} />
        <Metric label="Ultimo pull" value={formatTimestamp(status?.lastPull)} />
        <Metric label="Conflictos" value={String(conflicts.length || status?.pendingConflicts || 0)} />
      </div>

      {message ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs text-[var(--t2)]">
          {syncState === 'disconnected' ? (
            <ShieldAlert className="h-3.5 w-3.5 text-[var(--red)]" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--green)]" />
          )}
          {message}
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="mt-3 space-y-2">
          {conflicts.map((conflict) => (
            <div key={conflict.noteId} className="rounded-[var(--radius-md)] border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.08)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium text-[var(--t1)]">Conflicto en {conflict.server.title}</p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={buttonClassName} disabled={working} onClick={() => keepDesktop(conflict)}>
                    Conservar desktop
                  </button>
                  <button type="button" className={buttonClassName} disabled={working} onClick={() => keepServer(conflict)}>
                    Conservar servidor
                  </button>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <ConflictPreview title="Desktop" note={conflict.client} />
                <ConflictPreview title="Servidor" note={conflict.server} />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-[var(--t3)]">{label}</p>
      <p className="mt-1 truncate text-[var(--t1)]">{value}</p>
    </div>
  )
}

function ConflictPreview({ title, note }: { title: string; note: Note }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-2">
      <p className="mb-1 font-mono text-[10px] uppercase text-[var(--t3)]">{title}</p>
      <p className="truncate text-xs font-medium text-[var(--t1)]">{note.title}</p>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] text-[var(--t2)]">
        {note.content}
      </p>
    </div>
  )
}

function toEpoch(updatedAt: string): number {
  const parsed = Date.parse(updatedAt)
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0
}

function formatTimestamp(timestamp: number | null | undefined): string {
  if (!timestamp) {
    return 'Nunca'
  }
  return new Date(timestamp * 1000).toLocaleString()
}
