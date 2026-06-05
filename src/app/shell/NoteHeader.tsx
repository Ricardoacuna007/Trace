import { ChevronRight, Folder, MoreHorizontal, Share2 } from 'lucide-react'
import type { AppNode } from '../../types/workspace'

interface NoteHeaderProps {
  breadcrumbs: AppNode[]
}

export function NoteHeader({ breadcrumbs }: NoteHeaderProps) {
  return (
    <header className="flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-4">
      <div className="flex min-w-0 items-center gap-1 text-[12px] text-[var(--t2)]">
        {breadcrumbs.map((item, index) => (
          <div key={item.id} className="flex min-w-0 items-center gap-1">
            {index === 0 ? <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--amber)]" /> : null}
            <span className={index === breadcrumbs.length - 1 ? 'truncate text-[var(--t1)]' : 'truncate'}>
              {item.title}
            </span>
            {index < breadcrumbs.length - 1 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--t3)]" /> : null}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Compartir nota"
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--t2)] transition-all duration-150 hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Más opciones"
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--t2)] transition-all duration-150 hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
