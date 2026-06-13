import { Database, FolderOpen, FolderPlus, ShieldCheck } from 'lucide-react'

interface VaultSelectorProps {
  selecting: boolean
  error: string | null
  onPickVault: () => Promise<void> | void
}

export function VaultSelector({ selecting, error, onPickVault }: VaultSelectorProps) {
  const handlePickVault = () => {
    void onPickVault()
  }

  return (
    <section className="flex h-full items-center justify-center bg-[var(--bg)] px-5 text-[var(--t1)]">
      <div className="w-full max-w-3xl rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-5 shadow-2xl md:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-glow)] text-[var(--accent)]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--t3)]">
                trace / primer arranque
              </p>
            </div>
            <h1 className="m-0 text-[26px] font-light tracking-normal text-[var(--t1)]">
              Elige donde vivira tu conocimiento
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--t2)]">
              Trace guarda tus notas, grafo y preferencias dentro de una carpeta local. Puedes crear una nueva o abrir una que ya tenga una carpeta <code className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg)] px-1 py-0.5 font-mono text-[11px] text-[var(--t2)]">.trace</code>.
            </p>
          </div>
          <Database className="mt-1 h-5 w-5 shrink-0 text-[var(--t3)]" />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={handlePickVault}
            disabled={selecting}
            className="group rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-all duration-150 hover:-translate-y-px hover:border-[var(--border2)] hover:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="mb-3 grid h-9 w-9 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-glow)] text-[var(--accent)]">
              <FolderPlus className="h-4 w-4" />
            </span>
            <span className="block text-sm font-medium text-[var(--t1)]">Crear vault local</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--t2)]">
              Elige una carpeta vacia o nueva. Trace creara la base local automaticamente.
            </span>
          </button>

          <button
            type="button"
            onClick={handlePickVault}
            disabled={selecting}
            className="group rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-4 text-left transition-all duration-150 hover:-translate-y-px hover:border-[var(--border2)] hover:bg-[var(--bg3)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="mb-3 grid h-9 w-9 place-items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg2)] text-[var(--t2)] group-hover:text-[var(--t1)]">
              <FolderOpen className="h-4 w-4" />
            </span>
            <span className="block text-sm font-medium text-[var(--t1)]">Abrir vault existente</span>
            <span className="mt-1 block text-xs leading-relaxed text-[var(--t2)]">
              Selecciona una carpeta de Trace que ya usaste en esta maquina.
            </span>
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] px-3 py-2">
          <p className="font-mono text-[10px] text-[var(--t3)]">
            {selecting ? 'Abriendo selector...' : '.trace/trace.db se guarda dentro de la carpeta elegida'}
          </p>
          <button
            type="button"
            onClick={handlePickVault}
            disabled={selecting}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-3 text-xs font-medium text-white transition-colors hover:bg-[var(--accent2)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Elegir carpeta
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[rgba(248,113,113,0.35)] bg-[rgba(248,113,113,0.08)] px-3 py-2 text-xs text-[var(--red)]">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  )
}
