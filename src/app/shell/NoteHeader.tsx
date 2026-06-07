import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronRight,
  Command,
  FileText,
  Folder,
  MoreHorizontal,
  PanelRight,
  PlugZap,
  Printer,
  Share2,
} from 'lucide-react'
import type { Note } from '../../types/note'
import type { AppNode } from '../../types/workspace'

interface NoteHeaderProps {
  breadcrumbs: AppNode[]
  note: Note
  showBreadcrumb: boolean
  propertiesPanelOpen: boolean
  onExportMarkdown: () => void
  onOpenCommandPalette: () => void
  onOpenConnectModal: () => void
  onPrintCurrentNote: () => void
  onTogglePropertiesPanel: () => void
}

interface MenuActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fall back to the hidden textarea path below.
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

function MenuActionButton({ icon: Icon, label, onClick }: MenuActionButtonProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2 text-left text-[12px] text-[var(--t2)] transition-all duration-150 hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
      onClick={onClick}
    >
      <Icon className="h-4 w-4 text-[var(--t3)]" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

export function NoteHeader({
  breadcrumbs,
  note,
  showBreadcrumb,
  propertiesPanelOpen,
  onExportMarkdown,
  onOpenCommandPalette,
  onOpenConnectModal,
  onPrintCurrentNote,
  onTogglePropertiesPanel,
}: NoteHeaderProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const noteReference = `[[${note.title.trim() || 'Untitled'}]]`

  useEffect(() => {
    if (!menuOpen) {
      return undefined
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timeout = window.setTimeout(() => setFeedback(null), 2200)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  const handleCopyReference = async () => {
    const copied = await copyTextToClipboard(noteReference)
    setFeedback(copied ? 'Referencia copiada' : 'No se pudo copiar')
    setMenuOpen(false)
  }

  const runMenuAction = (action: () => void) => {
    action()
    setMenuOpen(false)
  }

  return (
    <header className="relative flex h-[var(--header-h)] shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-4">
      <div className="flex min-w-0 items-center gap-1 text-[12px] text-[var(--t2)]">
        {showBreadcrumb ? breadcrumbs.map((item, index) => (
          <div key={item.id} className="flex min-w-0 items-center gap-1" title={item.title}>
            {index === 0 ? <Folder className="h-3.5 w-3.5 shrink-0 text-[var(--amber)]" /> : null}
            <span className={index === breadcrumbs.length - 1 ? 'max-w-[44vw] truncate text-[var(--t1)]' : 'max-w-[18vw] truncate'}>
              {item.title}
            </span>
            {index < breadcrumbs.length - 1 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--t3)]" /> : null}
          </div>
        )) : null}
      </div>

      <div ref={menuRef} className="relative flex items-center gap-1">
        <button
          type="button"
          aria-label="Copiar referencia de nota"
          title="Copiar referencia"
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--t2)] transition-all duration-150 hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
          onClick={() => void handleCopyReference()}
        >
          <Share2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Mas opciones"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Mas opciones"
          className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] text-[var(--t2)] transition-all duration-150 hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            aria-label="Opciones de nota"
            className="absolute right-0 top-8 z-40 w-56 rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg2)] p-1.5 shadow-2xl"
          >
            <MenuActionButton icon={Share2} label="Copiar referencia" onClick={() => void handleCopyReference()} />
            <MenuActionButton icon={PlugZap} label="Conectar nota" onClick={() => runMenuAction(onOpenConnectModal)} />
            <MenuActionButton icon={FileText} label="Exportar Markdown" onClick={() => runMenuAction(onExportMarkdown)} />
            <MenuActionButton icon={Printer} label="Imprimir / PDF" onClick={() => runMenuAction(onPrintCurrentNote)} />
            <MenuActionButton
              icon={PanelRight}
              label={propertiesPanelOpen ? 'Ocultar propiedades' : 'Mostrar propiedades'}
              onClick={() => runMenuAction(onTogglePropertiesPanel)}
            />
            <div className="my-1 h-px bg-[var(--border)]" />
            <MenuActionButton icon={Command} label="Abrir comandos" onClick={() => runMenuAction(onOpenCommandPalette)} />
          </div>
        ) : null}
      </div>

      {feedback ? (
        <div className="pointer-events-none absolute right-4 top-[calc(100%+8px)] z-50 rounded-[var(--radius-md)] border border-[var(--border2)] bg-[var(--bg3)] px-3 py-1.5 text-[11px] text-[var(--t1)] shadow-xl">
          {feedback}
        </div>
      ) : null}
    </header>
  )
}
