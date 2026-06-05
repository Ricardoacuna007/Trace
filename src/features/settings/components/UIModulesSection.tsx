import type { TraceUIModules } from '../../../lib/db'

interface UIModulesSectionProps {
  editorWidth: 'full' | 'centered'
  uiModules: TraceUIModules
  onSetEditorWidth: (width: 'full' | 'centered') => void
  onToggleModule: (module: keyof TraceUIModules, enabled: boolean) => void
}

function editorWidthButtonClassName(active: boolean): string {
  return `rounded-[var(--radius-md)] border px-2.5 py-1.5 text-xs transition-all duration-150 ease-in-out ${
    active
      ? 'border-[rgba(94,139,255,0.3)] bg-[var(--accent-glow)] text-[var(--accent)]'
      : 'border-[var(--border)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
  }`
}

const toggleClassName = 'h-4 w-4 rounded border-[var(--border2)] bg-[var(--bg4)] accent-[var(--accent)]'

export function UIModulesSection({
  editorWidth,
  uiModules,
  onSetEditorWidth,
  onToggleModule,
}: UIModulesSectionProps) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]">
        Apariencia y modulos UI (Zen Mode)
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
          <p className="mb-2 text-xs font-medium text-[var(--t1)]">Ancho del editor</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSetEditorWidth('centered')}
              className={editorWidthButtonClassName(editorWidth === 'centered')}
            >
              Centrado
            </button>
            <button
              type="button"
              onClick={() => onSetEditorWidth('full')}
              className={editorWidthButtonClassName(editorWidth === 'full')}
            >
              Completo
            </button>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
          <p className="mb-2 text-xs font-medium text-[var(--t1)]">Visibilidad modular</p>
          <div className="space-y-2 text-xs">
            <label className="flex items-center justify-between gap-3 text-[var(--t2)]">
              <span>Mostrar migas de pan</span>
              <input
                type="checkbox"
                checked={uiModules.show_breadcrumbs}
                onChange={(event) => onToggleModule('show_breadcrumbs', event.target.checked)}
                className={toggleClassName}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[var(--t2)]">
              <span>Mostrar backlinks por defecto</span>
              <input
                type="checkbox"
                checked={uiModules.show_backlinks}
                onChange={(event) => onToggleModule('show_backlinks', event.target.checked)}
                className={toggleClassName}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[var(--t2)]">
              <span>Mostrar iconos en explorador</span>
              <input
                type="checkbox"
                checked={uiModules.show_node_icons}
                onChange={(event) => onToggleModule('show_node_icons', event.target.checked)}
                className={toggleClassName}
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-[var(--t2)]">
              <span>Habilitar autoguardado</span>
              <input
                type="checkbox"
                checked={uiModules.enable_autosave}
                onChange={(event) => onToggleModule('enable_autosave', event.target.checked)}
                className={toggleClassName}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  )
}
