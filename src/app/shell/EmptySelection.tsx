interface EmptySelectionProps {
  onCreateNote: () => void
}

export function EmptySelection({ onCreateNote }: EmptySelectionProps) {
  return (
    <section className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-dashed border-trace-border bg-trace-panel px-6 py-8 text-center">
        <p className="mb-2 text-sm text-slate-200">No hay nada seleccionado.</p>
        <p className="mb-4 text-xs text-trace-muted">
          Usa la paleta con Ctrl+K o crea una nota con Ctrl+N.
        </p>
        <button
          type="button"
          onClick={onCreateNote}
          className="rounded-lg border border-sky-300/35 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition-colors duration-150 ease-in-out hover:bg-sky-300/20"
        >
          Crear nota
        </button>
      </div>
    </section>
  )
}
