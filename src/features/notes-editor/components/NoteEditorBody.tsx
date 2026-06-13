import type { Block } from '@blocknote/core'
import { Suspense, lazy } from 'react'
import type { TraceCodeRunnerSettings } from '../../../lib/db'
import type { Note } from '../../../types/note'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { FallbackTextareaEditor } from './FallbackTextareaEditor'

const LazyBlockNoteEditor = lazy(async () => {
  const module = await import('../BlockNoteEditor')
  return { default: module.BlockNoteEditor }
})

interface NoteEditorBodyProps {
  note: Note
  traceCodeRunnerSettings: TraceCodeRunnerSettings
  onContentChange: (noteId: string, blocks: Block[]) => void
  onOpenWikiLink: (title: string) => void
}

export function NoteEditorBody({
  note,
  traceCodeRunnerSettings,
  onContentChange,
  onOpenWikiLink,
}: NoteEditorBodyProps) {
  return (
    <div className="trace-editor animate-fadeIn flex-1 min-h-0 overflow-hidden">
      <EditorErrorBoundary
        resetKey={note.id}
        fallback={(errorMessage) => (
          <FallbackTextareaEditor note={note} onChange={onContentChange} errorMessage={errorMessage} />
        )}
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-trace-muted">
              Cargando editor...
            </div>
          }
        >
          <LazyBlockNoteEditor
            note={note}
            traceCodeRunnerSettings={traceCodeRunnerSettings}
            onChange={onContentChange}
            onOpenWikiLink={onOpenWikiLink}
          />
        </Suspense>
      </EditorErrorBoundary>
    </div>
  )
}
