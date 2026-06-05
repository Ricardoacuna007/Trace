import { RefreshCw, Save, Settings2 } from 'lucide-react'

interface SettingsHeaderProps {
  configDraft: string
  cssDraft: string
  customizationLoading: boolean
  customizationSaving: boolean
  hasChanges: boolean
  traceDir: string | null
  vaultPath: string | null
  onReloadCustomization: () => void
  onSaveCustomization: (configJson: string, customCss: string) => void
}

export function SettingsHeader({
  configDraft,
  cssDraft,
  customizationLoading,
  customizationSaving,
  hasChanges,
  traceDir,
  vaultPath,
  onReloadCustomization,
  onSaveCustomization,
}: SettingsHeaderProps) {
  return (
    <header className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent-glow)] text-[var(--accent)]">
              <Settings2 className="h-4 w-4" />
            </span>
            <h1 className="m-0 text-[22px] font-light text-[var(--t1)]">Configuracion de la boveda</h1>
          </div>
          <p className="text-sm text-[var(--t2)]">
            Personaliza `trace.config.json` y `custom.css` en tu carpeta `.trace`.
          </p>
          <p className="mt-2 max-w-full truncate font-mono text-[11px] text-[var(--t3)]">
            {traceDir ? `Carpeta .trace: ${traceDir}` : 'Carpeta .trace no disponible'}
          </p>
          <p className="mt-1 max-w-full truncate font-mono text-[11px] text-[var(--t3)]">
            {vaultPath ? `Boveda activa: ${vaultPath}` : 'No hay boveda activa'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReloadCustomization}
            disabled={customizationLoading || customizationSaving}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-1.5 text-xs text-[var(--t2)] transition-colors duration-150 ease-in-out hover:border-[var(--border2)] hover:text-[var(--t1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recargar
          </button>
          <button
            type="button"
            onClick={() => onSaveCustomization(configDraft, cssDraft)}
            disabled={customizationSaving || !hasChanges}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[rgba(94,139,255,0.3)] bg-[var(--accent-glow)] px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition-colors duration-150 ease-in-out hover:bg-[rgba(94,139,255,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {customizationSaving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </header>
  )
}
