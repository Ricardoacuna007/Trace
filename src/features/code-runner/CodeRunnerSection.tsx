import { AlertTriangle, Check, Play, Square, Terminal } from 'lucide-react'
import { useMemo } from 'react'
import type { TraceCodeRunnerSettings } from '../../lib/db'
import { extractCodeBlocks } from './codeBlocks'
import type { CodeOutput } from './useCodeRunner'
import { useCodeRunner } from './useCodeRunner'

interface CodeRunnerSectionProps {
  content: string
  settings: TraceCodeRunnerSettings
}

function outputLabel(output: CodeOutput): string {
  if (output.cancelled) {
    return `cancelado en ${output.durationMs}ms`
  }
  if (output.timedOut) {
    return `timeout en ${output.durationMs}ms`
  }
  if (output.status === 0) {
    return `ok en ${output.durationMs}ms`
  }
  return `salida ${output.status ?? 'sin codigo'} en ${output.durationMs}ms`
}

export function CodeRunnerSection({ content, settings }: CodeRunnerSectionProps) {
  const snippets = useMemo(() => extractCodeBlocks(content), [content])
  const runner = useCodeRunner(settings)

  if (snippets.length === 0) {
    return <p className="text-[11px] text-[var(--t3)]">Sin bloques ejecutables.</p>
  }

  return (
    <div className="space-y-2">
      {runner.detectionError ? (
        <div className="flex gap-2 rounded-[var(--radius-md)] border border-[rgba(248,113,113,0.24)] bg-[rgba(248,113,113,0.07)] px-2 py-2 text-[11px] text-[var(--red)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{runner.detectionError}</span>
        </div>
      ) : null}

      {snippets.map((snippet) => {
        const canRun = runner.canRun(snippet.language)
        const result = runner.results[snippet.id]
        const running = runner.isRunning(snippet.id)

        return (
          <div key={snippet.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Terminal className="h-3.5 w-3.5 shrink-0 text-[var(--t3)]" />
                <span className="truncate font-mono text-[10px] text-[var(--t2)]">{snippet.label}</span>
              </div>
              <button
                type="button"
                disabled={!running && !canRun}
                className="flex h-6 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[rgba(94,139,255,0.3)] bg-[var(--accent-glow)] px-2 text-[10px] font-medium text-[var(--accent)] transition-colors hover:bg-[rgba(94,139,255,0.2)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--bg2)] disabled:text-[var(--t3)]"
                onClick={() => {
                  if (running) {
                    void runner.cancelBlock(snippet.id)
                    return
                  }
                  void runner.runBlock(snippet)
                }}
              >
                {running ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {running ? 'Stop' : 'Run'}
              </button>
            </div>

            {!canRun ? (
              <p className="text-[10px] text-[var(--t3)]">{snippet.language} no disponible.</p>
            ) : null}

            {result ? (
              <div className="mt-2 overflow-hidden rounded-[var(--radius-sm)] border border-[var(--border)] bg-black/25">
                <div className="flex items-center gap-1.5 border-b border-[var(--border)] px-2 py-1 font-mono text-[10px] text-[var(--t3)]">
                  {result.status === 0 && !result.timedOut && !result.cancelled ? (
                    <Check className="h-3 w-3 text-[var(--green)]" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-[var(--amber)]" />
                  )}
                  <span>{outputLabel(result)}</span>
                </div>
                {result.stdout ? (
                  <pre className="trace-scrollbar max-h-36 overflow-auto whitespace-pre-wrap px-2 py-2 font-mono text-[10px] leading-relaxed text-[var(--t1)]">
                    {result.stdout}
                  </pre>
                ) : null}
                {result.stderr ? (
                  <pre className="trace-scrollbar max-h-36 overflow-auto whitespace-pre-wrap border-t border-[var(--border)] px-2 py-2 font-mono text-[10px] leading-relaxed text-[var(--red)]">
                    {result.stderr}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
