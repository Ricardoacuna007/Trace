import { FolderOpen, ShieldCheck } from 'lucide-react'

interface VaultSelectorProps {
  selecting: boolean
  error: string | null
  onPickVault: () => Promise<void> | void
}

export function VaultSelector({ selecting, error, onPickVault }: VaultSelectorProps) {
  return (
    <section className="flex h-full items-center justify-center px-5">
      <div className="w-full max-w-2xl rounded-2xl border border-trace-border bg-trace-panel p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-sky-300" />
          <p className="m-0 text-sm font-semibold tracking-wide text-slate-100">Trace Vaults</p>
        </div>

        <h1 className="m-0 text-2xl font-semibold text-slate-100">Selecciona una boveda local</h1>
        <p className="mt-2 text-sm text-trace-muted">
          Trace guardara la base SQLite dentro de <code className="rounded bg-slate-800/70 px-1 py-0.5 text-xs">.trace/trace.db</code> en la carpeta que elijas.
        </p>

        <button
          type="button"
          onClick={() => {
            void onPickVault()
          }}
          disabled={selecting}
          className="mt-5 inline-flex items-center gap-2 rounded-lg border border-sky-300/35 bg-sky-300/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-300/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FolderOpen className="h-4 w-4" />
          {selecting ? 'Abriendo selector...' : 'Elegir carpeta de boveda'}
        </button>

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-400/35 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  )
}

