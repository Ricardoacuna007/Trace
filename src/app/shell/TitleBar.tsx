import { LayoutGrid, Pencil, Share2 } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useTraceStore } from '../../store/useTraceStore'
import type { AppViewMode } from '../../store/types'

const tabs: Array<{ view: AppViewMode; label: string; icon: typeof Pencil }> = [
  { view: 'editor', label: 'Editor', icon: Pencil },
  { view: 'graph', label: 'Grafo', icon: Share2 },
  { view: 'workspace', label: 'Workspace', icon: LayoutGrid },
]

export function TitleBar() {
  const { activeView, activeVaultPath, nodes, setActiveView } = useTraceStore(
    useShallow((state) => ({
      activeView: state.activeView,
      activeVaultPath: state.activeVaultPath,
      nodes: state.nodes,
      setActiveView: state.setActiveView,
    })),
  )
  const workspaceTitle = nodes.find((node) => node.type === 'workspace')?.title
    ?? activeVaultPath?.split(/[\\/]/).filter(Boolean).at(-1)
    ?? 'Workspace'

  return (
    <header
      data-tauri-drag-region
      className="flex h-[var(--titlebar-h)] shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg2)] px-3"
    >
      <div data-tauri-drag-region className="flex items-center gap-1.5">
        <span className="h-[11px] w-[11px] rounded-full bg-[var(--red)]/85" />
        <span className="h-[11px] w-[11px] rounded-full bg-[var(--amber)]/85" />
        <span className="h-[11px] w-[11px] rounded-full bg-[var(--green)]/85" />
      </div>

      <div data-tauri-drag-region className="flex min-w-0 items-center gap-1.5 text-[12px]">
        <div className="flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg3)] text-[var(--accent)]">
          T
        </div>
        <span className="font-medium text-[var(--t1)]">Trace</span>
        <span className="text-[var(--t3)]">/</span>
        <span className="truncate text-[var(--t2)]">{workspaceTitle}</span>
      </div>

      <nav className="mx-auto flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-0.5">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeView === tab.view
          return (
            <button
              key={tab.view}
              type="button"
              onClick={() => setActiveView(tab.view)}
              className={`flex h-7 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-[12px] transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--bg3)] text-[var(--accent)]'
                  : 'text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div data-tauri-drag-region className="w-[128px]" />
    </header>
  )
}
