import { Command } from 'cmdk'
import { FileText, Folder, FolderPlus, Search, Settings2, Share2, Zap } from 'lucide-react'
import type { AppViewMode, ViewMode } from '../../store/types'
import type { AppNode } from '../../types/workspace'
import { formatRelativeTime } from '../../features/notes-editor/contentMetrics'

interface CommandPaletteProps {
  activeNoteId: string | null
  nodes: AppNode[]
  open: boolean
  query: string
  onCreateFolder: () => void
  onCreateNote: () => void
  onExportMarkdown: () => void
  onOpenChange: (open: boolean) => void
  onOpenConnect: () => void
  onOpenNote: (noteId: string) => void
  onOpenSettings: () => void
  onQueryChange: (query: string) => void
  onSwitchView: (view: AppViewMode | ViewMode) => void
}

function itemClass() {
  return 'mb-1 flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-transparent px-3 py-2 text-[12px] text-[var(--t2)] transition-all duration-150 data-[selected=true]:border-[var(--border2)] data-[selected=true]:bg-[var(--bg3)] data-[selected=true]:text-[var(--t1)]'
}

export function CommandPalette({
  activeNoteId,
  nodes,
  open,
  query,
  onCreateFolder,
  onCreateNote,
  onExportMarkdown,
  onOpenChange,
  onOpenConnect,
  onOpenNote,
  onOpenSettings,
  onQueryChange,
  onSwitchView,
}: CommandPaletteProps) {
  if (!open) {
    return null
  }

  const notes = nodes
    .filter((node) => node.type === 'note')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const recentNotes = notes.slice(0, 5)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-24">
      <button
        type="button"
        aria-label="Cerrar paleta de comandos"
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full max-w-[480px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg2)] shadow-2xl">
        <Command label="Paleta de comandos" className="w-full bg-transparent">
          <div className="flex h-11 items-center gap-2 border-b border-[var(--border)] px-3">
            <Search className="h-4 w-4 text-[var(--t3)]" />
            <Command.Input
              value={query}
              onValueChange={onQueryChange}
              autoFocus
              placeholder="Buscar notas o ejecutar comandos..."
              className="w-full bg-transparent text-[13px] text-[var(--t1)] outline-none placeholder:text-[var(--t3)]"
            />
            <span className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t3)]">
              Esc
            </span>
          </div>

          <Command.List className="trace-scrollbar max-h-[420px] overflow-y-auto p-2">
            <Command.Empty className="px-3 py-8 text-center text-[12px] text-[var(--t3)]">
              Sin coincidencias.
            </Command.Empty>

            <Command.Group heading="Notas recientes">
              {recentNotes.map((note) => (
                <Command.Item
                  key={`recent-${note.id}`}
                  value={`reciente ${note.title}`}
                  onSelect={() => {
                    onOpenNote(note.id)
                    onOpenChange(false)
                  }}
                  className={itemClass()}
                >
                  <FileText className="h-4 w-4 text-[var(--t3)]" />
                  <span className="min-w-0 flex-1 truncate text-[var(--t1)]">{note.title}</span>
                  <span className="font-mono text-[10px] text-[var(--t3)]">{formatRelativeTime(note.updatedAt)}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Todas las notas">
              {notes.map((note) => (
                <Command.Item
                  key={note.id}
                  value={`nota ${note.title}`}
                  onSelect={() => {
                    onOpenNote(note.id)
                    onOpenChange(false)
                  }}
                  className={itemClass()}
                >
                  <FileText className="h-4 w-4 text-[var(--t3)]" />
                  <span className="truncate text-[var(--t1)]">{note.title}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Acciones">
              <Command.Item
                value="nueva nota crear"
                onSelect={() => {
                  onCreateNote()
                  onOpenChange(false)
                }}
                className={itemClass()}
              >
                <Zap className="h-4 w-4 text-[var(--accent)]" />
                Nueva nota
              </Command.Item>
              <Command.Item
                value="nueva carpeta"
                onSelect={() => {
                  onCreateFolder()
                  onOpenChange(false)
                }}
                className={itemClass()}
              >
                <FolderPlus className="h-4 w-4 text-[var(--amber)]" />
                Nueva carpeta
              </Command.Item>
              <Command.Item
                value="conectar nota"
                disabled={!activeNoteId}
                onSelect={() => {
                  onOpenConnect()
                  onOpenChange(false)
                }}
                className={itemClass()}
              >
                <Share2 className="h-4 w-4 text-[var(--accent)]" />
                Conectar nota
              </Command.Item>
              <Command.Item
                value="exportar markdown md"
                onSelect={() => {
                  onExportMarkdown()
                  onOpenChange(false)
                }}
                className={itemClass()}
              >
                <FileText className="h-4 w-4 text-[var(--t3)]" />
                Exportar MD
              </Command.Item>
              <Command.Item
                value="abrir workspace"
                onSelect={() => {
                  onSwitchView('workspace')
                  onOpenChange(false)
                }}
                className={itemClass()}
              >
                <Folder className="h-4 w-4 text-[var(--amber)]" />
                Abrir workspace
              </Command.Item>
              <Command.Item
                value="abrir config configuracion"
                onSelect={() => {
                  onOpenSettings()
                  onOpenChange(false)
                }}
                className={itemClass()}
              >
                <Settings2 className="h-4 w-4 text-[var(--t3)]" />
                Abrir config
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
