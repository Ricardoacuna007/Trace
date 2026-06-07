import type { Block } from '@blocknote/core'
import { useEffect, useRef } from 'react'
import { countWords, formatRelativeTime, readingMinutes } from '../../features/notes-editor/contentMetrics'
import { NoteEditorBody } from '../../features/notes-editor/components/NoteEditorBody'
import type { Note } from '../../types/note'

interface EditorWrapperProps {
  note: Note
  editorWidth: 'full' | 'centered'
  showModifiedAt: boolean
  showWordCount: boolean
  onContentChange: (noteId: string, blocks: Block[]) => void
  onOpenWikiLink: (title: string) => void
  onTitleChange: (noteId: string, title: string) => void
}

export function EditorWrapper({
  note,
  editorWidth,
  showModifiedAt,
  showWordCount,
  onContentChange,
  onOpenWikiLink,
  onTitleChange,
}: EditorWrapperProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const words = countWords(note.content)
  const minutes = readingMinutes(words)
  const metaItems = [
    showModifiedAt ? `modificado ${formatRelativeTime(note.updatedAt)}` : null,
    showWordCount ? `${words} palabras` : null,
    showWordCount ? `${minutes} min lectura` : null,
  ].filter((item): item is string => item !== null)
  const contentWidthClassName = editorWidth === 'full'
    ? 'w-full max-w-none'
    : 'mx-auto w-full max-w-[820px]'

  useEffect(() => {
    const titleElement = titleRef.current
    if (!titleElement) {
      return
    }

    titleElement.style.height = '0px'
    const maxHeight = 96
    const nextHeight = Math.min(titleElement.scrollHeight, maxHeight)
    titleElement.style.height = `${nextHeight}px`
    titleElement.style.overflowY = titleElement.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [note.title, editorWidth])

  return (
    <section className="trace-scrollbar min-h-0 flex-1 overflow-y-auto bg-[var(--bg)] px-0 py-3 md:px-12">
      <div className={`flex min-h-full flex-col ${contentWidthClassName}`}>
        <textarea
          ref={titleRef}
          value={note.title}
          onChange={(event) => onTitleChange(note.id, event.target.value.replace(/\s*\r?\n\s*/g, ' '))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
            }
          }}
          aria-label="Titulo de nota"
          title={note.title}
          rows={1}
          spellCheck
          className="mb-1 max-h-24 min-h-[32px] w-full resize-none break-words bg-transparent text-[26px] font-light leading-tight tracking-normal text-[var(--t1)] outline-none placeholder:text-[var(--t3)]"
          placeholder="Untitled"
        />
        {metaItems.length > 0 ? (
          <div className="mb-8 font-mono text-[11px] text-[var(--t3)]">
            {metaItems.join(' · ')}
          </div>
        ) : (
          <div className="mb-5" />
        )}
        <NoteEditorBody note={note} onContentChange={onContentChange} onOpenWikiLink={onOpenWikiLink} />
      </div>
    </section>
  )
}
