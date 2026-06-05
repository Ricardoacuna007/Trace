import { Clock, Plus, Search, Star, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { TreeNode as WorkspaceTreeNode } from '../../types/workspace'
import { TreeNode } from './TreeNode'

interface SidebarProps {
  nodeTree: WorkspaceTreeNode[]
  selectedNodeId: string | null
  pinnedNoteIds: string[]
  showNodeIcons: boolean
  onCreateNote: () => void
  onOpenCommandPalette: () => void
  onPinNote: (noteId: string) => void
  onSelectNode: (id: string) => void
  onSetWorkspaceView: () => void
  onUnpinNote: (noteId: string) => void
}

interface NavItemProps {
  active?: boolean
  badge?: number
  icon: typeof Clock
  label: string
  onClick: () => void
}

function NavItem({ active = false, badge, icon: Icon, label, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-8 w-full items-center gap-2 rounded-[var(--radius-md)] px-2 text-left text-[12px] transition-all duration-150 ${
        active
          ? 'bg-[var(--accent-glow)] text-[var(--accent)]'
          : 'text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
      }`}
    >
      {active ? <span className="absolute left-0 top-1.5 h-5 w-[2px] rounded-full bg-[var(--accent)]" /> : null}
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1 truncate">{label}</span>
      {typeof badge === 'number' && badge > 0 ? (
        <span className="rounded-full border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t3)]">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

export function Sidebar({
  nodeTree,
  selectedNodeId,
  pinnedNoteIds,
  showNodeIcons,
  onCreateNote,
  onOpenCommandPalette,
  onPinNote,
  onSelectNode,
  onSetWorkspaceView,
  onUnpinNote,
}: SidebarProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set())
  const tagCount = useMemo(() => {
    const tags = new Set<string>()
    const walk = (nodes: WorkspaceTreeNode[]) => {
      for (const node of nodes) {
        if (node.type === 'note') {
          for (const tag of node.tags ?? []) {
            tags.add(tag)
          }
        }
        walk(node.children)
      }
    }
    walk(nodeTree)
    return tags.size
  }, [nodeTree])

  const toggleCollapse = (id: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <aside className="trace-scrollbar flex h-full w-[var(--sidebar-w)] shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--bg2)]">
      <div className="border-b border-[var(--border)] p-2.5">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex h-8 w-full items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-2 text-left text-[12px] text-[var(--t2)] transition-all duration-150 hover:border-[var(--border2)] hover:text-[var(--t1)]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 truncate">Buscar notas...</span>
          <kbd className="rounded border border-[var(--border2)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--t3)]">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="space-y-1 border-b border-[var(--border)] p-2">
        <NavItem icon={Clock} label="Recientes" onClick={onSetWorkspaceView} />
        <NavItem icon={Star} label="Favoritos" badge={pinnedNoteIds.length} onClick={onSetWorkspaceView} />
        <NavItem icon={Tag} label="Etiquetas" badge={tagCount} onClick={onSetWorkspaceView} />
      </div>

      <div className="trace-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
        <div className="mb-1 px-1.5 font-mono text-[10px] uppercase tracking-wide text-[var(--t3)]">
          Árbol
        </div>
        {nodeTree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            activeNodeId={selectedNodeId}
            collapsedIds={collapsedIds}
            pinnedNoteIds={pinnedNoteIds}
            showNodeIcons={showNodeIcons}
            onSelectNode={onSelectNode}
            onToggleCollapse={toggleCollapse}
            onPinNote={onPinNote}
            onUnpinNote={onUnpinNote}
          />
        ))}
      </div>

      <div className="border-t border-[var(--border)] p-2.5">
        <button
          type="button"
          onClick={onCreateNote}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-[12px] font-medium text-white transition-all duration-150 hover:bg-[var(--accent2)]"
        >
          <Plus className="h-4 w-4" />
          Nueva nota
        </button>
      </div>
    </aside>
  )
}
