import type { Block } from '@blocknote/core'
import { useState } from 'react'
import type { Note } from '../../../types/note'
import { blocksFromPlainText, extractPlainTextFromContent } from '../note-utils'

interface FallbackTextareaEditorProps {
  errorMessage: string | null
  note: Note
  onChange: (noteId: string, blocks: Block[]) => void
}

export function FallbackTextareaEditor({
  errorMessage,
  note,
  onChange,
}: FallbackTextareaEditorProps) {
  const [text, setText] = useState(() => extractPlainTextFromContent(note.content))

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 rounded-2xl border border-amber-200/25 bg-amber-100/5 p-4">
      <div className="rounded-xl border border-amber-200/25 bg-amber-100/10 px-3 py-2 text-xs text-amber-100">
        BlockNote no pudo cargarse en este WebView2. Se activo modo seguro con editor de texto plano.
      </div>
      {errorMessage ? (
        <pre className="trace-scrollbar max-h-28 overflow-auto rounded-xl border border-amber-200/25 bg-black/30 px-3 py-2 text-[11px] text-amber-100/90">
          {errorMessage}
        </pre>
      ) : null}
      <textarea
        value={text}
        onChange={(event) => {
          const next = event.target.value
          setText(next)
          onChange(note.id, blocksFromPlainText(next))
        }}
        placeholder="Escribe tu nota aqui..."
        className="trace-scrollbar h-full min-h-0 resize-none rounded-xl border border-trace-border bg-trace-panel px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-200/40 placeholder:text-trace-muted focus:ring-2"
      />
    </div>
  )
}
