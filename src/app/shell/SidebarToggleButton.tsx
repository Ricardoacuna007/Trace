import { PanelLeftOpen } from 'lucide-react'

interface SidebarToggleButtonProps {
  onToggleSidebar: () => void
}

export function SidebarToggleButton({ onToggleSidebar }: SidebarToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggleSidebar}
      title="Mostrar sidebar (Ctrl+\\)"
      className="absolute left-3 top-3 z-20 inline-flex items-center gap-1 rounded-md border border-trace-border bg-trace-panelSoft/80 px-2 py-1 text-xs text-slate-200 transition-colors duration-150 ease-in-out hover:bg-slate-700/50"
    >
      <PanelLeftOpen className="h-3.5 w-3.5" />
      Sidebar
    </button>
  )
}
