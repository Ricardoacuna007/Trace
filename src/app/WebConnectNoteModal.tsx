import { Check, FileText, PlugZap, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { NoteRelation } from '../store/types'
import type { Note } from '../types/note'
import type { AppNode } from '../types/workspace'

interface WebConnectNoteModalProps {
  activeNote: Note | null
  notes: AppNode[]
  noteRelations: NoteRelation[]
  open: boolean
  onClose: () => void
  onConnectNotes: (sourceId: string, targetIds: string[]) => void
}

function isNote(node: AppNode): node is Note {
  return node.type === 'note' && typeof node.content === 'string'
}

export function WebConnectNoteModal({
  activeNote,
  notes,
  noteRelations,
  open,
  onClose,
  onConnectNotes,
}: WebConnectNoteModalProps) {
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

  const connectedIds = useMemo(() => new Set(
    noteRelations
      .filter((relation) => relation.sourceId === activeNote?.id)
      .map((relation) => relation.targetId),
  ), [activeNote?.id, noteRelations])

  const filteredNotes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return notes
      .filter(isNote)
      .filter((note) => note.id !== activeNote?.id)
      .filter((note) => normalizedQuery.length === 0 || note.title.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [activeNote?.id, notes, query])

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  if (!open || !activeNote) {
    return null
  }

  const toggleSelection = (noteId: string) => {
    if (connectedIds.has(noteId)) {
      return
    }
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(noteId)) {
        next.delete(noteId)
      } else {
        next.add(noteId)
      }
      return next
    })
  }

  const confirmConnections = () => {
    const targets = Array.from(selectedIds)
    if (targets.length === 0) {
      return
    }

    onConnectNotes(activeNote.id, targets)
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="web-connect-note-title"
        className="w-full max-w-[520px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg2)] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-glow)] text-[var(--accent)]">
              <PlugZap className="h-4 w-4" />
            </div>
            <div>
              <h2 id="web-connect-note-title" className="text-sm font-medium text-[var(--t1)]">Conectar nota</h2>
              <p className="text-[11px] text-[var(--t3)]">Crea un backlink bidireccional</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-[var(--border)] p-3">
          <label className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-2 text-[12px] text-[var(--t2)]">
            <Search className="h-4 w-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Buscar nota para conectar..."
              className="w-full bg-transparent text-[var(--t1)] outline-none placeholder:text-[var(--t3)]"
            />
          </label>
        </div>

        <div className="trace-scrollbar max-h-[320px] overflow-y-auto p-2">
          {filteredNotes.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] text-[var(--t3)]">No hay notas para conectar.</p>
          ) : (
            filteredNotes.map((note) => {
              const connected = connectedIds.has(note.id)
              const selected = selectedIds.has(note.id)
              return (
                <button
                  key={note.id}
                  type="button"
                  disabled={connected}
                  onClick={() => toggleSelection(note.id)}
                  className={`mb-1 flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-transparent px-2.5 py-2 text-left transition-all duration-150 ${
                    connected
                      ? 'cursor-not-allowed opacity-55'
                      : 'hover:border-[var(--border2)] hover:bg-[var(--bg3)]'
                  }`}
                >
                  <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    selected
                      ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                      : 'border-[var(--border2)] bg-[var(--bg)]'
                  }`}>
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <FileText className="h-4 w-4 shrink-0 text-[var(--t3)]" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--t1)]">{note.title}</span>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(74,222,128,0.25)] bg-[rgba(74,222,128,0.08)] px-2 py-0.5 font-mono text-[10px] text-[var(--green)]">
                      <Check className="h-3 w-3" />
                      conectada
                    </span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
          <span className="font-mono text-[11px] text-[var(--t3)]">{selectedIds.size} seleccionadas</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-[var(--radius-md)] border border-[var(--border)] px-3 text-[12px] text-[var(--t2)] hover:border-[var(--border2)] hover:text-[var(--t1)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmConnections}
              disabled={selectedIds.size === 0}
              className="h-8 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-[12px] font-medium text-white transition-all duration-150 hover:bg-[var(--accent2)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Conectar -&gt;
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
