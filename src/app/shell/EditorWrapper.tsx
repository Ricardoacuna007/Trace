import type { Block } from '@blocknote/core'
import { NoteEditorBody } from '../../features/notes-editor/components/NoteEditorBody'
import type { Note } from '../../types/note'
import { countWords, formatRelativeTime, readingMinutes } from '../../features/notes-editor/contentMetrics'

interface EditorWrapperProps {
  note: Note
  editorWidth: 'full' | 'centered'
  onContentChange: (noteId: string, blocks: Block[]) => void
  onOpenWikiLink: (title: string) => void
  onTitleChange: (noteId: string, title: string) => void
}

export function EditorWrapper({
  note,
  editorWidth,
  onContentChange,
  onOpenWikiLink,
  onTitleChange,
}: EditorWrapperProps) {
  const words = countWords(note.content)
  const minutes = readingMinutes(words)
  const contentWidthClassName = editorWidth === 'full'
    ? 'w-full max-w-none'
    : 'mx-auto w-full max-w-[820px]'

  return (
    <section className="trace-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--bg)] px-8 py-3 md:px-12">
      <div className={`flex min-h-full flex-col ${contentWidthClassName}`}>
        <input
          value={note.title}
          onChange={(event) => onTitleChange(note.id, event.target.value)}
          aria-label="Título de nota"
          className="mb-1 w-full bg-transparent text-[26px] font-light leading-tight tracking-normal text-[var(--t1)] outline-none placeholder:text-[var(--t3)]"
          placeholder="Untitled"
        />
        <div className="mb-8 font-mono text-[11px] text-[var(--t3)]">
          modificado {formatRelativeTime(note.updatedAt)} · {words} palabras · {minutes} min lectura
        </div>
        <NoteEditorBody note={note} onContentChange={onContentChange} onOpenWikiLink={onOpenWikiLink} />
      </div>
    </section>
  )
}
