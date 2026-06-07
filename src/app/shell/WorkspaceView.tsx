import { FileText, Folder, FolderPlus, Plus } from 'lucide-react'
import type { NoteRelation } from '../../store/types'
import type { AppNode } from '../../types/workspace'
import { countWords, formatRelativeTime, previewFromContent } from '../../features/notes-editor/contentMetrics'

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

export function WorkspaceView({
  activeVaultPath,
  nodes,
  noteRelations,
  onCreateFolder,
  onCreateNote,
  onOpenNote,
}: WorkspaceViewProps) {
  const notes = nodes.filter((node) => node.type === 'note')
  const totalWords = notes.reduce((total, note) => (
    total + (typeof note.content === 'string' ? countWords(note.content) : 0)
  ), 0)
  const recentItems = [...nodes]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8)

  return (
    <section className="trace-scrollbar h-full overflow-y-auto bg-[var(--bg)] px-8 py-7">
      <div className="mx-auto max-w-[980px]">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] text-[var(--t3)]">workspace /</p>
            <h1 className="mt-1 truncate text-[26px] font-light text-[var(--t1)]" title={workspaceTitle(nodes, activeVaultPath)}>
              {workspaceTitle(nodes, activeVaultPath)}
            </h1>
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
          <StatCard label="Notas" value={notes.length} sub="documentos locales" />
          <StatCard label="Conexiones" value={noteRelations.length} sub="relaciones guardadas" />
          <StatCard label="Palabras totales" value={totalWords} sub="estimado del vault" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {recentItems.map((item) => {
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
