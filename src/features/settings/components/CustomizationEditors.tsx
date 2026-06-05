interface CustomizationEditorsProps {
  configDraft: string
  configSource: string
  cssDraft: string
  cssSource: string
  onConfigDraftChange: (source: string, value: string) => void
  onCssDraftChange: (source: string, value: string) => void
}

export function CustomizationEditors({
  configDraft,
  configSource,
  cssDraft,
  cssSource,
  onConfigDraftChange,
  onCssDraftChange,
}: CustomizationEditorsProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <article className="flex min-h-[320px] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
        <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]">
          trace.config.json
        </p>
        <textarea
          value={configDraft}
          onChange={(event) => onConfigDraftChange(configSource, event.target.value)}
          className="trace-scrollbar h-full min-h-[260px] w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 font-mono text-xs leading-5 text-[var(--t1)] outline-none transition-colors duration-150 placeholder:text-[var(--t3)] focus:border-[rgba(94,139,255,0.55)]"
          spellCheck={false}
        />
      </article>

      <article className="flex min-h-[320px] flex-col rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg2)] p-4">
        <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--t3)]">
          custom.css
        </p>
        <textarea
          value={cssDraft}
          onChange={(event) => onCssDraftChange(cssSource, event.target.value)}
          className="trace-scrollbar h-full min-h-[260px] w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg3)] px-3 py-2 font-mono text-xs leading-5 text-[var(--t1)] outline-none transition-colors duration-150 placeholder:text-[var(--t3)] focus:border-[rgba(94,139,255,0.55)]"
          spellCheck={false}
        />
      </article>
    </section>
  )
}
