import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Check, Loader2, X } from 'lucide-react'
import { isTauri } from '../../lib/env'

async function closeQuickCaptureWindow() {
  if (!isTauri()) {
    window.close()
    return
  }

  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  await getCurrentWindow().close()
}

export function QuickCaptureWindow() {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const close = useCallback(() => {
    void closeQuickCaptureWindow()
  }, [])

  const save = useCallback(async () => {
    if (saving || saved) {
      return
    }

    const trimmed = value.trim()
    if (!trimmed) {
      setError('Escribe una idea para guardarla.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await invoke('create_inbox_note', { content: value })
      setSaved(true)
      window.setTimeout(() => {
        void closeQuickCaptureWindow()
      }, 240)
    } catch (rawError) {
      setError(rawError instanceof Error ? rawError.message : String(rawError))
      setSaving(false)
    }
  }, [saving, saved, value])

  return (
    <main className="flex h-full overflow-hidden bg-[var(--bg)] p-3 text-[var(--t1)]">
      <section className="flex h-full w-full flex-col rounded-[var(--radius-lg)] border border-[var(--border2)] bg-[var(--bg2)] shadow-2xl shadow-black/40">
        <div className="flex h-8 items-center justify-between border-b border-[var(--border)] px-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--t3)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_14px_var(--accent)]" />
            Captura rapida
          </div>
          <button
            type="button"
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--t3)] transition-colors hover:bg-[var(--bg3)] hover:text-[var(--t1)]"
            aria-label="Cerrar captura rapida"
            onClick={close}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1">
          <textarea
            ref={textareaRef}
            value={value}
            disabled={saving || saved}
            aria-label="Captura rapida"
            placeholder="Escribe una idea..."
            className="h-full w-full resize-none bg-transparent px-3 py-2 text-[14px] leading-5 text-[var(--t1)] outline-none placeholder:text-[var(--t3)] disabled:opacity-70"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                close()
                return
              }

              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void save()
              }
            }}
          />

          <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-2 font-mono text-[10px] text-[var(--t3)]">
            {saving && (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                guardando
              </>
            )}
            {saved && (
              <>
                <Check className="h-3 w-3 text-[var(--green)]" />
                guardada
              </>
            )}
            {!saving && !saved && 'Enter guarda'}
          </div>
        </div>

        {error && (
          <div className="border-t border-[rgba(248,113,113,0.28)] px-3 py-1.5 text-[11px] text-[var(--red)]">
            {error}
          </div>
        )}
      </section>
    </main>
  )
}
