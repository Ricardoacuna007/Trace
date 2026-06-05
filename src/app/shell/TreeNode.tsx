import { ChevronDown, ChevronRight, FileText, Folder, Pin } from 'lucide-react'
import type { TreeNode as WorkspaceTreeNode } from '../../types/workspace'

interface TreeNodeProps {
  node: WorkspaceTreeNode
  activeNodeId: string | null
  collapsedIds: Set<string>
  depth?: number
  pinnedNoteIds: string[]
  showNodeIcons: boolean
  onSelectNode: (id: string) => void
  onToggleCollapse: (id: string) => void
  onPinNote: (noteId: string) => void
  onUnpinNote: (noteId: string) => void
}

export function TreeNode({
  node,
  activeNodeId,
  collapsedIds,
  depth = 0,
  pinnedNoteIds,
  showNodeIcons,
  onSelectNode,
  onToggleCollapse,
  onPinNote,
  onUnpinNote,
}: TreeNodeProps) {
  const isFolder = node.type !== 'note'
  const isCollapsed = collapsedIds.has(node.id)
  const isActive = activeNodeId === node.id
  const isPinned = pinnedNoteIds.includes(node.id)
  const Icon = isFolder ? Folder : FileText

  return (
    <div>
      <div
        className={`group relative flex h-7 items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 text-[12px] transition-all duration-150 ${
          isActive
            ? 'text-[var(--accent)]'
            : 'text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
        }`}
        style={{ paddingLeft: `${6 + depth * 12}px` }}
      >
        {isFolder ? (
          <button
            type="button"
            aria-label={isCollapsed ? 'Expandir carpeta' : 'Colapsar carpeta'}
            onClick={() => onToggleCollapse(node.id)}
            className="flex h-4 w-4 items-center justify-center rounded-[var(--radius-sm)] text-[var(--t3)] hover:bg-[var(--bg4)] hover:text-[var(--t1)]"
          >
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="h-4 w-4" />
        )}

        <button
          type="button"
          onClick={() => onSelectNode(node.id)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {showNodeIcons ? (
            <Icon className={`h-3.5 w-3.5 shrink-0 ${isFolder ? 'text-[var(--amber)]' : isActive ? 'text-[var(--accent)]' : 'text-[var(--t3)]'}`} />
          ) : null}
          <span className="truncate">{node.title}</span>
        </button>

        {node.type === 'note' ? (
          <button
            type="button"
            aria-label={isPinned ? 'Desanclar nota' : 'Anclar nota'}
            onClick={() => {
              if (isPinned) {
                onUnpinNote(node.id)
                return
              }
              onPinNote(node.id)
            }}
            className={`flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] transition-opacity duration-150 hover:bg-[var(--bg4)] ${
              isPinned
                ? 'text-[var(--accent)] opacity-100'
                : 'text-[var(--t3)] opacity-0 group-hover:opacity-100'
            }`}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isFolder && !isCollapsed ? (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              activeNodeId={activeNodeId}
              collapsedIds={collapsedIds}
              depth={depth + 1}
              pinnedNoteIds={pinnedNoteIds}
              showNodeIcons={showNodeIcons}
              onSelectNode={onSelectNode}
              onToggleCollapse={onToggleCollapse}
              onPinNote={onPinNote}
              onUnpinNote={onUnpinNote}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
