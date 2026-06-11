import { FileText, X } from 'lucide-react'
import type { GraphCluster } from './clusters'

interface ClusterPanelProps {
  cluster: GraphCluster
  onClose: () => void
  onOpenNote: (noteId: string) => void
}

export function ClusterPanel({ cluster, onClose, onOpenNote }: ClusterPanelProps) {
  return (
    <aside className="absolute right-3 top-3 z-20 w-[260px] rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg3)] p-3 shadow-2xl">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cluster.color }} />
            <p className="truncate text-[12px] font-medium text-[var(--t1)]">{cluster.label}</p>
          </div>
          <p className="font-mono text-[10px] text-[var(--t3)]">{cluster.notes.length} notas</p>
        </div>
        <button
          type="button"
          aria-label="Cerrar cluster"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--t3)] transition-colors hover:bg-[var(--bg4)] hover:text-[var(--t1)]"
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>

      <div className="space-y-1.5">
        {cluster.notes.map((note) => (
          <button
            key={note.id}
            type="button"
            className="group flex w-full gap-2 rounded-[var(--radius-md)] border border-transparent px-2 py-2 text-left transition-all hover:border-[var(--border2)] hover:bg-[var(--bg4)]"
            onClick={() => onOpenNote(note.id)}
          >
            <FileText size={14} className="mt-0.5 shrink-0 text-[var(--t3)] group-hover:text-[var(--accent)]" />
            <span className="min-w-0">
              <span className="block truncate text-[12px] text-[var(--t1)]">{note.title}</span>
              {note.preview ? (
                <span className="line-clamp-2 text-[10px] leading-snug text-[var(--t3)]">{note.preview}</span>
              ) : null}
            </span>
          </button>
        ))}
      </div>
    </aside>
  )
}
