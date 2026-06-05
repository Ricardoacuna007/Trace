import { Link, Pin, PlugZap, Tag } from 'lucide-react'
import type { Note } from '../../types/note'

interface NoteMetaBarProps {
  note: Note
  isPinned: boolean
  connectionCount: number
  onOpenConnectModal: () => void
}

function Pill({
  children,
  accent = false,
  onClick,
}: {
  accent?: boolean
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1 text-[11px] transition-all duration-150 ${
        accent
          ? 'border-[rgba(94,139,255,0.3)] bg-[var(--accent-glow)] font-medium text-[var(--accent)] hover:bg-[rgba(94,139,255,0.2)]'
          : 'border-[var(--border)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--border2)] hover:text-[var(--t1)]'
      }`}
    >
      {children}
    </button>
  )
}

export function NoteMetaBar({
  note,
  isPinned,
  connectionCount,
  onOpenConnectModal,
}: NoteMetaBarProps) {
  return (
    <div className="flex min-h-[44px] shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--bg)] px-12 py-3.5">
      {isPinned ? (
        <Pill>
          <Pin className="h-3.5 w-3.5 text-[var(--accent)]" />
          Anclada
        </Pill>
      ) : null}

      {(note.tags ?? []).map((tag) => (
        <Pill key={tag}>
          <Tag className="h-3.5 w-3.5" />
          {tag}
        </Pill>
      ))}

      {connectionCount > 0 ? (
        <Pill>
          <Link className="h-3.5 w-3.5" />
          {connectionCount} conexiones
        </Pill>
      ) : null}

      <span className="mx-1 h-3.5 w-px bg-[var(--border2)]" />

      <Pill accent onClick={onOpenConnectModal}>
        <PlugZap className="h-3.5 w-3.5" />
        Conectar nota
      </Pill>
    </div>
  )
}
