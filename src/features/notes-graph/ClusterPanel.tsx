import { Check, FileText, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import type { GraphCluster } from './clusters'

interface ClusterPanelProps {
  cluster: GraphCluster
  onClose: () => void
  onOpenNote: (noteId: string) => void
  onRenameCluster: (label: string) => void
}

export function ClusterPanel({ cluster, onClose, onOpenNote, onRenameCluster }: ClusterPanelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cluster.label)

  const commitRename = () => {
    const label = draft.trim()
    onRenameCluster(label)
    setEditing(false)
  }

  return (
    <aside className="absolute right-3 top-3 z-20 w-[260px] rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg3)] p-3 shadow-2xl">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cluster.color }} />
            {editing ? (
              <input
                value={draft}
                autoFocus
                aria-label="Nombre del cluster"
                className="h-7 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border2)] bg-[var(--bg)] px-2 text-[12px] font-medium text-[var(--t1)] outline-none focus:border-[var(--accent)]"
                onBlur={commitRename}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    commitRename()
                  }
                  if (event.key === 'Escape') {
                    setDraft(cluster.label)
                    setEditing(false)
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-[var(--t1)] hover:text-[var(--accent)]"
                title={cluster.label}
                onDoubleClick={() => setEditing(true)}
              >
                {cluster.label}
              </button>
            )}
            <button
              type="button"
              aria-label={editing ? 'Guardar nombre de cluster' : 'Renombrar cluster'}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--t3)] transition-colors hover:bg-[var(--bg4)] hover:text-[var(--t1)]"
              onClick={() => {
                if (editing) {
                  commitRename()
                  return
                }
                setEditing(true)
              }}
            >
              {editing ? <Check size={13} /> : <Pencil size={12} />}
            </button>
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
