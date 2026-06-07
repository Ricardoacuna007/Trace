import { ArrowRight, CheckCircle2, Clock, FileText, Folder, FolderPlus, Plus, RotateCcw } from 'lucide-react'
import { formatRelativeTime, previewFromContent } from '../../features/notes-editor/contentMetrics'
import type { NoteRelation } from '../../store/types'
import type { AppNode } from '../../types/workspace'
import {
  buildWorkspaceInsights,
  notePreview,
  type UnfinishedNoteItem,
  type WeeklyActivityItem,
} from './workspaceInsights'

interface WorkspaceViewProps {
  activeVaultPath: string | null
  nodes: AppNode[]
  noteRelations: NoteRelation[]
  onCreateFolder: () => void
  onCreateNote: () => void
  onOpenNote: (noteId: string) => void
}

function workspaceTitle(nodes: AppNode[], activeVaultPath: string | null): string {
  return nodes.find((node) => node.type === 'workspace')?.title
    ?? activeVaultPath?.split(/[\\/]/).filter(Boolean).at(-1)
    ?? 'Workspace'
}

function StatCard({ label, sub, value }: { label: string; sub: string; value: string | number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[var(--t3)]">{label}</p>
      <p className="mt-2 text-[22px] font-light text-[var(--t1)]">{value}</p>
      <p className="mt-1 text-[10px] text-[var(--t3)]">{sub}</p>
    </div>
  )
}

function SectionTitle({ label }: { label: string }) {
  return (
    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--t3)]">
      {label}
    </p>
  )
}

function EmptyLine({ label }: { label: string }) {
  return <p className="text-[12px] leading-relaxed text-[var(--t3)]">{label}</p>
}

function LastSessionCard({
  item,
  onOpenNote,
}: {
  item: ReturnType<typeof buildWorkspaceInsights>['lastSession']
  onOpenNote: (noteId: string) => void
}) {
  if (!item) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
        <SectionTitle label="Ultima sesion" />
        <EmptyLine label="Crea tu primera nota para que Trace recuerde donde estabas." />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onOpenNote(item.id)}
      className="rounded-[var(--radius-lg)] border border-[rgba(94,139,255,0.22)] bg-[var(--accent-glow)] p-4 text-left transition-all duration-150 hover:-translate-y-px hover:border-[rgba(94,139,255,0.38)]"
    >
      <SectionTitle label="Ultima sesion" />
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[rgba(94,139,255,0.28)] bg-[rgba(94,139,255,0.12)] text-[var(--accent)]">
          <Clock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 break-words text-[17px] font-light leading-snug text-[var(--t1)]" title={item.title}>
            {item.title}
          </h2>
          <p className="mt-1 font-mono text-[10px] text-[var(--t3)]">
            editada {formatRelativeTime(item.updatedAt)}
          </p>
          <p className="mt-3 line-clamp-2 text-[12px] leading-relaxed text-[var(--t2)]">
            {notePreview(item)}
          </p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--accent)]" />
      </div>
    </button>
  )
}

function WeeklyActivity({
  items,
  onOpenNote,
}: {
  items: WeeklyActivityItem[]
  onOpenNote: (noteId: string) => void
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <SectionTitle label="Esta semana" />
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <EmptyLine label="Sin movimiento reciente." />
        ) : items.map((item) => (
          <button
            key={item.note.id}
            type="button"
            onClick={() => onOpenNote(item.note.id)}
            className="group grid w-full grid-cols-[minmax(0,1fr)_84px] items-center gap-3 text-left"
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] text-[var(--t1)]" title={item.note.title}>{item.note.title}</p>
              <p className="mt-0.5 font-mono text-[10px] text-[var(--t3)]">
                {item.words} palabras · {item.connectionCount} conexiones
              </p>
            </div>
            <span className="h-1.5 overflow-hidden rounded-full bg-[var(--bg4)]">
              <span
                className="block h-full rounded-full bg-[var(--accent)] opacity-75 transition-opacity duration-150 group-hover:opacity-100"
                style={{ width: `${item.intensity}%` }}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function UnfinishedSection({
  items,
  onOpenNote,
}: {
  items: UnfinishedNoteItem[]
  onOpenNote: (noteId: string) => void
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <SectionTitle label="Sin terminar" />
      <div className="space-y-2">
        {items.length === 0 ? (
          <EmptyLine label="No hay notas claramente incompletas." />
        ) : items.map((item) => (
          <button
            key={item.note.id}
            type="button"
            onClick={() => onOpenNote(item.note.id)}
            className="flex w-full items-start gap-2 rounded-[var(--radius-md)] px-1 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--bg3)]"
          >
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--amber)]" />
            <span className="min-w-0">
              <span className="block truncate text-[12px] text-[var(--t1)]" title={item.note.title}>{item.note.title}</span>
              <span className="mt-0.5 block font-mono text-[10px] text-[var(--t3)]">{item.reason}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function WorkspaceView({
  activeVaultPath,
  nodes,
  noteRelations,
  onCreateFolder,
  onCreateNote,
  onOpenNote,
}: WorkspaceViewProps) {
  const visibleNodes = nodes.filter((node) => !node.inbox)
  const insights = buildWorkspaceInsights(nodes, noteRelations)
  const recentItems = [...visibleNodes]
    .filter((node) => node.type !== 'workspace')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)
  const welcomeTime = insights.lastSession
    ? `hace ${formatRelativeTime(insights.lastSession.updatedAt).replace(/^hace\s+/, '')}`
    : 'listo para empezar'

  return (
    <section className="trace-scrollbar h-full overflow-y-auto bg-[var(--bg)] px-8 py-7">
      <div className="mx-auto max-w-[980px]">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-[var(--t3)]">workspace /</p>
            <h1 className="mt-1 truncate text-[26px] font-light text-[var(--t1)]" title={workspaceTitle(nodes, activeVaultPath)}>
              {workspaceTitle(nodes, activeVaultPath)}
            </h1>
            <p className="mt-1 font-mono text-[10px] text-[var(--t3)]">
              Bienvenido de vuelta · {welcomeTime}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateFolder}
              className="flex h-8 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg2)] px-3 text-[12px] text-[var(--t2)] hover:border-[var(--border2)] hover:text-[var(--t1)]"
            >
              <FolderPlus className="h-4 w-4" />
              Carpeta
            </button>
            <button
              type="button"
              onClick={onCreateNote}
              className="flex h-8 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-[12px] font-medium text-white hover:bg-[var(--accent2)]"
            >
              <Plus className="h-4 w-4" />
              Nueva nota
            </button>
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard label="Notas" value={insights.notes.length} sub="documentos locales" />
          <StatCard label="Conexiones" value={noteRelations.length} sub="relaciones guardadas" />
          <StatCard label="Palabras totales" value={insights.totalWords} sub="estimado del vault" />
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
          <LastSessionCard item={insights.lastSession} onOpenNote={onOpenNote} />
          <WeeklyActivity items={insights.weeklyActivity} onOpenNote={onOpenNote} />
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.75fr)]">
          <UnfinishedSection items={insights.unfinished} onOpenNote={onOpenNote} />
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
            <SectionTitle label="De hace mas de 30 dias" />
            {insights.oldNote ? (
              <button
                type="button"
                onClick={() => onOpenNote(insights.oldNote!.id)}
                className="flex w-full items-start gap-2 rounded-[var(--radius-md)] px-1 py-1.5 text-left transition-colors duration-150 hover:bg-[var(--bg3)]"
              >
                <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--t3)]" />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] text-[var(--t1)]" title={insights.oldNote.title}>{insights.oldNote.title}</span>
                  <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--t2)]">
                    {previewFromContent(insights.oldNote.content)}
                  </span>
                </span>
              </button>
            ) : (
              <EmptyLine label="Todavia no hay notas antiguas para rescatar." />
            )}
          </div>
        </div>

        <SectionTitle label="Recientes" />
        <div className="grid gap-3 md:grid-cols-2">
          {recentItems.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4 text-[12px] text-[var(--t3)]">
              Sin notas todavia.
            </div>
          ) : recentItems.map((item) => {
            const isNote = item.type === 'note'
            const Icon = isNote ? FileText : Folder
            const preview = isNote && typeof item.content === 'string'
              ? previewFromContent(item.content)
              : 'Contenedor de conocimiento.'

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (isNote) {
                    onOpenNote(item.id)
                  }
                }}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4 text-left transition-all duration-150 hover:-translate-y-px hover:border-[var(--border2)] hover:bg-[var(--bg3)]"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isNote ? 'text-[var(--t3)]' : 'text-[var(--amber)]'}`} />
                  <span className="line-clamp-2 min-w-0 flex-1 break-words text-sm font-medium leading-snug text-[var(--t1)]" title={item.title}>
                    {item.title}
                  </span>
                </div>
                <p className="mb-2 font-mono text-[10px] uppercase text-[var(--t3)]">
                  {item.type} · {formatRelativeTime(item.updatedAt)}
                </p>
                <p className="line-clamp-2 text-[12px] leading-relaxed text-[var(--t2)]">{preview}</p>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
