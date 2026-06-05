import { ArrowLeft, DatabaseBackup, Download, LogOut, RefreshCw, RotateCcw, Server, Shield, Trash2, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { clearAccessToken, getAccessToken } from '../lib/auth'
import { apiFetch, apiJson } from '../lib/http'

interface WebSettingsProps {
  onBack: () => void
  onLogout: () => void
}

interface HealthResponse {
  status: string
  version: string
}

interface AuditEvent {
  id: string
  event: string
  userId?: string | null
  ip?: string | null
  detail: unknown
  createdAt: number
}

const sectionClassName = 'rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4'
const buttonClassName = 'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs font-medium text-[var(--t2)] transition-colors duration-150 hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60'
const dangerButtonClassName = 'inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.1)] px-3 py-2 text-xs font-medium text-[var(--red)] transition-colors duration-150 hover:bg-[rgba(248,113,113,0.16)] disabled:cursor-not-allowed disabled:opacity-60'

export function WebSettings({ onBack, onLogout }: WebSettingsProps) {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([])
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreConfirm, setRestoreConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const hasAccessToken = useMemo(() => (getAccessToken() ?? '').trim().length > 0, [])
  const restoreReady = restoreFile !== null && restoreConfirm.trim() === 'RESTORE'

  useEffect(() => {
    void refreshSettings()
  }, [])

  async function refreshSettings(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const [nextHealth, nextAuditLog] = await Promise.all([
        apiJson<HealthResponse>('/health'),
        apiJson<AuditEvent[]>('/api/admin/audit-log?limit=20'),
      ])
      setHealth(nextHealth)
      setAuditLog(nextAuditLog)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo cargar settings')
    } finally {
      setBusy(false)
    }
  }

  async function downloadBackup(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      const response = await apiFetch('/api/backup', { method: 'POST' })
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = backupFilename(response.headers.get('content-disposition'))
      link.click()
      URL.revokeObjectURL(objectUrl)
      setMessage('Backup descargado')
      await refreshSettings()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear backup')
    } finally {
      setBusy(false)
    }
  }

  async function restoreBackup(): Promise<void> {
    if (!restoreFile || !restoreReady) {
      return
    }

    setBusy(true)
    setMessage(null)
    try {
      await apiFetch('/api/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/zip',
        },
        body: restoreFile,
      })
      setRestoreFile(null)
      setRestoreConfirm('')
      setMessage('Backup restaurado')
      await refreshSettings()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo restaurar backup')
    } finally {
      setBusy(false)
    }
  }

  async function revokeAllSessions(): Promise<void> {
    setBusy(true)
    setMessage(null)
    try {
      await apiFetch('/api/auth/revoke-all', { method: 'POST' })
      clearAccessToken()
      onLogout()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron revocar sesiones')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="trace-scrollbar h-full overflow-y-auto bg-[var(--bg)] px-5 py-5 text-[var(--t1)] md:px-7 md:py-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-[var(--t3)]">self-host /</p>
            <h1 className="text-[26px] font-light text-[var(--t1)]">Settings</h1>
          </div>
          <button type="button" className={buttonClassName} onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </button>
        </header>

        <section className={sectionClassName}>
          <SectionTitle icon={<Shield className="h-4 w-4" />} title="Cuenta" />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Metric label="Sesion" value={hasAccessToken ? 'Activa' : 'Sin token activo'} />
            <Metric label="Modo" value="Self-host web" />
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionTitle icon={<Server className="h-4 w-4" />} title="Servidor" />
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <Metric label="Estado" value={health?.status ?? 'Sin verificar'} />
            <Metric label="Version" value={health?.version ?? '-'} />
            <Metric label="Origen" value={window.location.origin} />
          </div>
          <button type="button" className={`${buttonClassName} mt-3`} disabled={busy} onClick={() => void refreshSettings()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </button>
        </section>

        <section className={sectionClassName}>
          <SectionTitle icon={<Shield className="h-4 w-4" />} title="Seguridad" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={dangerButtonClassName} disabled={busy} onClick={() => void revokeAllSessions()}>
              <RotateCcw className="h-3.5 w-3.5" />
              Revocar todas las sesiones
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)]">
            {auditLog.slice(0, 8).map((event) => (
              <div key={event.id} className="grid gap-1 border-b border-[var(--border)] bg-[var(--bg3)] px-3 py-2 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)_120px]">
                <span className="font-mono text-[10px] text-[var(--t3)]">{formatAuditTime(event.createdAt)}</span>
                <span className="truncate text-xs text-[var(--t1)]">{event.event}</span>
                <span className="truncate font-mono text-[10px] text-[var(--t3)]">{event.ip ?? 'local'}</span>
              </div>
            ))}
            {auditLog.length === 0 ? (
              <div className="bg-[var(--bg3)] px-3 py-3 text-xs text-[var(--t3)]">Sin eventos recientes</div>
            ) : null}
          </div>
        </section>

        <section className={sectionClassName}>
          <SectionTitle icon={<DatabaseBackup className="h-4 w-4" />} title="Datos" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={buttonClassName} disabled={busy} onClick={() => void downloadBackup()}>
              <Download className="h-3.5 w-3.5" />
              Descargar backup
            </button>
            <label className={buttonClassName}>
              <Upload className="h-3.5 w-3.5" />
              Elegir ZIP
              <input
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(event) => setRestoreFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_160px]">
            <input
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs text-[var(--t1)] outline-none focus:border-[var(--accent)]"
              placeholder="Escribe RESTORE"
              value={restoreConfirm}
              onChange={(event) => setRestoreConfirm(event.target.value)}
            />
            <button type="button" className={dangerButtonClassName} disabled={busy || !restoreReady} onClick={() => void restoreBackup()}>
              Restaurar
            </button>
          </div>
          {restoreFile ? <p className="mt-2 text-[11px] text-[var(--t3)]">{restoreFile.name}</p> : null}
        </section>

        <section className={sectionClassName}>
          <SectionTitle icon={<Trash2 className="h-4 w-4" />} title="Danger zone" />
          <button type="button" className={`${dangerButtonClassName} mt-3`} disabled={busy} onClick={onLogout}>
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesion
          </button>
        </section>

        {message ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 text-xs text-[var(--t2)]">
            {message}
          </div>
        ) : null}
      </div>
    </main>
  )
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-[var(--t1)]">
      <span className="text-[var(--accent)]">{icon}</span>
      {title}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-[var(--t3)]">{label}</p>
      <p className="mt-1 truncate text-xs text-[var(--t1)]">{value}</p>
    </div>
  )
}

function formatAuditTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString()
}

function backupFilename(contentDisposition: string | null): string {
  const filename = contentDisposition?.match(/filename="([^"]+)"/)?.[1]
  return filename ?? `trace-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.zip`
}
