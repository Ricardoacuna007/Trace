import { useState, type ReactNode } from 'react'
import type { TraceLayoutConfig, TraceUIModules } from '../../../lib/db'

interface UIModulesSectionProps {
  editorWidth: 'full' | 'centered'
  traceTheme: 'dark' | 'light'
  traceAccentColor: string
  traceFontFamily: string
  traceLayout: TraceLayoutConfig
  uiModules: TraceUIModules
  onSetEditorWidth: (width: 'full' | 'centered') => void
  onUpdateTraceAppearance: (patch: Partial<{
    theme: 'dark' | 'light'
    accent_color: string
    font_family: string
  }>) => void
  onUpdateTraceLayout: (layout: TraceLayoutConfig) => void
  onToggleModule: (module: keyof TraceUIModules, enabled: boolean) => void
}

const toggleClassName = 'h-4 w-4 rounded border-[var(--border2)] bg-[var(--bg4)] accent-[var(--accent)]'
const inputClassName = 'h-8 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--t1)] outline-none transition-colors focus:border-[var(--accent)]'
const accentPresets = ['#5e8bff', '#4ade80', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee']
const fontOptions = ['DM Sans', 'Inter', 'system-ui', 'Georgia']

function segmentedClassName(active: boolean): string {
  return `rounded-[var(--radius-md)] border px-2.5 py-1.5 text-xs transition-all duration-150 ease-in-out ${
    active
      ? 'border-[rgba(94,139,255,0.3)] bg-[var(--accent-glow)] text-[var(--accent)]'
      : 'border-[var(--border)] bg-[var(--bg2)] text-[var(--t2)] hover:border-[var(--border2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
  }`
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-2 text-xs font-medium text-[var(--t1)]">{children}</p>
}

export function UIModulesSection({
  editorWidth,
  traceTheme,
  traceAccentColor,
  traceFontFamily,
  traceLayout,
  uiModules,
  onSetEditorWidth,
  onUpdateTraceAppearance,
  onUpdateTraceLayout,
  onToggleModule,
}: UIModulesSectionProps) {
  const [accentDraft, setAccentDraft] = useState<string | null>(null)
  const safeAccentColor = isHexColor(traceAccentColor) ? traceAccentColor : '#5e8bff'
  const accentInputValue = accentDraft ?? traceAccentColor

  const commitAccentColor = (value: string) => {
    if (isHexColor(value)) {
      onUpdateTraceAppearance({ accent_color: value })
      setAccentDraft(null)
    }
  }

  const updateVisibleElement = (
    key: keyof TraceLayoutConfig['visible_elements'],
    value: boolean,
  ) => {
    onUpdateTraceLayout({
      ...traceLayout,
      visible_elements: {
        ...traceLayout.visible_elements,
        [key]: value,
      },
    })
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]">
        Apariencia
      </p>

      <div className="grid gap-3 xl:grid-cols-3">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
          <FieldLabel>Tema y acento</FieldLabel>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => onUpdateTraceAppearance({ theme: 'dark' })}
              className={segmentedClassName(traceTheme === 'dark')}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => onUpdateTraceAppearance({ theme: 'light' })}
              className={segmentedClassName(traceTheme === 'light')}
            >
              Light
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={safeAccentColor}
              aria-label="Color de acento"
              className="h-8 w-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-1"
              onChange={(event) => {
                commitAccentColor(event.target.value)
              }}
            />
            <input
              value={accentInputValue}
              aria-label="Codigo de color de acento"
              className={`${inputClassName} min-w-0 flex-1 font-mono`}
              onBlur={(event) => commitAccentColor(event.target.value)}
              onChange={(event) => setAccentDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitAccentColor(event.currentTarget.value)
                }
              }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {accentPresets.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Usar acento ${color}`}
                className="h-5 w-5 rounded-full border border-[var(--border2)] transition-transform hover:scale-110"
                style={{ backgroundColor: color }}
                onClick={() => onUpdateTraceAppearance({ accent_color: color })}
              />
            ))}
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
          <FieldLabel>Editor</FieldLabel>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => onSetEditorWidth('centered')}
              className={segmentedClassName(editorWidth === 'centered')}
            >
              Centrado
            </button>
            <button
              type="button"
              onClick={() => onSetEditorWidth('full')}
              className={segmentedClassName(editorWidth === 'full')}
            >
              Completo
            </button>
          </div>
          <label className="block text-xs text-[var(--t2)]">
            Fuente del cuerpo
            <select
              value={traceFontFamily}
              className={`${inputClassName} mt-1 w-full`}
              onChange={(event) => onUpdateTraceAppearance({ font_family: event.target.value })}
            >
              {fontOptions.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
          <FieldLabel>Layout</FieldLabel>
          <div className="mb-3 flex flex-wrap gap-2">
            {(['left', 'right', 'hidden'] as const).map((position) => (
              <button
                key={position}
                type="button"
                onClick={() => onUpdateTraceLayout({ ...traceLayout, sidebar_position: position })}
                className={segmentedClassName(traceLayout.sidebar_position === position)}
              >
                {position === 'left' ? 'Sidebar izq.' : position === 'right' ? 'Sidebar der.' : 'Oculto'}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['visible', 'collapsed', 'hidden'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onUpdateTraceLayout({ ...traceLayout, right_panel: mode })}
                className={segmentedClassName(traceLayout.right_panel === mode)}
              >
                {mode === 'visible' ? 'Panel visible' : mode === 'collapsed' ? 'Colapsado' : 'Sin panel'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
          <FieldLabel>Elementos visibles</FieldLabel>
          <div className="space-y-2 text-xs">
            <ToggleRow label="Barra de titulo" checked={traceLayout.visible_elements.titlebar} onChange={(value) => updateVisibleElement('titlebar', value)} />
            <ToggleRow label="Controles de trafico" checked={traceLayout.visible_elements.traffic_lights} onChange={(value) => updateVisibleElement('traffic_lights', value)} />
            <ToggleRow label="Breadcrumb de nota" checked={traceLayout.visible_elements.breadcrumb} onChange={(value) => updateVisibleElement('breadcrumb', value)} />
            <ToggleRow label="NoteMetaBar" checked={traceLayout.visible_elements.metabar} onChange={(value) => updateVisibleElement('metabar', value)} />
            <ToggleRow label="Timestamp de modificacion" checked={traceLayout.visible_elements.modified_at} onChange={(value) => updateVisibleElement('modified_at', value)} />
            <ToggleRow label="Conteo de palabras" checked={traceLayout.visible_elements.word_count} onChange={(value) => updateVisibleElement('word_count', value)} />
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-3">
          <FieldLabel>Modulos UI</FieldLabel>
          <div className="space-y-2 text-xs">
            <ToggleRow
              label="Mostrar backlinks por defecto"
              checked={uiModules.show_backlinks}
              onChange={(value) => onToggleModule('show_backlinks', value)}
            />
            <ToggleRow
              label="Mostrar iconos en explorador"
              checked={uiModules.show_node_icons}
              onChange={(value) => onToggleModule('show_node_icons', value)}
            />
            <ToggleRow
              label="Habilitar autoguardado"
              checked={uiModules.enable_autosave}
              onChange={(value) => onToggleModule('enable_autosave', value)}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function isHexColor(value: string): boolean {
  return /^#[\da-f]{6}$/i.test(value.trim())
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-[var(--t2)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={toggleClassName}
      />
    </label>
  )
}
