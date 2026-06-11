import { BlockNoteView, type Theme } from '@blocknote/mantine'
import '@blocknote/mantine/style.css'
import { useCreateBlockNote } from '@blocknote/react'
import { useCallback, useEffect, useMemo, useRef, type MouseEvent } from 'react'
import type { Block } from '@blocknote/core'
import { useInlineCodeRunner } from '../code-runner/useInlineCodeRunner'
import { parseBlocks } from './note-utils'
import { getWikiLinkAtTextOffset } from './wikiLinks'
import type { Note } from '../../types/note'

interface BlockNoteEditorProps {
  note: Note
  onChange: (noteId: string, blocks: Block[]) => void
  onOpenWikiLink: (title: string) => void
}

type HighlightLike = object

interface HighlightConstructor {
  new (...ranges: Range[]): HighlightLike
}

interface HighlightRegistryLike {
  delete: (name: string) => void
  set: (name: string, highlight: HighlightLike) => void
}

type CssWithHighlights = typeof CSS & {
  highlights?: HighlightRegistryLike
}

interface WindowWithHighlight extends Window {
  Highlight?: HighlightConstructor
}

const traceBlockNoteTheme: Theme = {
  colors: {
    editor: { text: 'var(--t1)', background: 'var(--bg)' },
    menu: { text: 'var(--t1)', background: 'var(--bg2)' },
    tooltip: { text: 'var(--t1)', background: 'var(--bg3)' },
    hovered: { text: 'var(--t1)', background: 'var(--bg3)' },
    selected: { text: 'var(--accent)', background: 'var(--accent-glow)' },
    disabled: { text: 'var(--t3)', background: 'var(--bg)' },
    shadow: 'var(--border2)',
    border: 'var(--border)',
    sideMenu: 'var(--t3)',
  },
  borderRadius: 7,
  fontFamily: 'DM Sans, sans-serif',
}

function ensureWikiLinkHighlightStyle() {
  const styleId = 'trace-wiki-highlight-style'
  if (document.getElementById(styleId)) {
    return
  }

  const styleTag = document.createElement('style')
  styleTag.id = styleId
  styleTag.textContent = `
    ::highlight(trace-wiki-link) {
      color: var(--accent);
      text-decoration: underline;
      text-decoration-color: rgba(94, 139, 255, 0.35);
      text-underline-offset: 3px;
    }
  `
  document.head.appendChild(styleTag)
}

function highlightWikiLinks() {
  const cssWithHighlights = CSS as CssWithHighlights
  const HighlightConstructorValue = (window as WindowWithHighlight).Highlight
  if (!cssWithHighlights.highlights || !HighlightConstructorValue) {
    return
  }

  ensureWikiLinkHighlightStyle()

  const editorElement = document.querySelector('.trace-editor .bn-editor')
  if (!editorElement) {
    cssWithHighlights.highlights.delete('trace-wiki-link')
    return
  }

  const ranges: Range[] = []
  const walker = document.createTreeWalker(editorElement, NodeFilter.SHOW_TEXT)
  let currentNode = walker.nextNode()
  while (currentNode) {
    const text = currentNode.textContent ?? ''
    const matcher = /\[\[[^\]]+\]\]/g
    let match = matcher.exec(text)
    while (match) {
      const range = document.createRange()
      range.setStart(currentNode, match.index)
      range.setEnd(currentNode, match.index + match[0].length)
      ranges.push(range)
      match = matcher.exec(text)
    }
    currentNode = walker.nextNode()
  }

  cssWithHighlights.highlights.set('trace-wiki-link', new HighlightConstructorValue(...ranges))
}

function getTextPositionFromPoint(clientX: number, clientY: number): { node: Text; offset: number } | null {
  const docWithCaretPosition = document as unknown as {
    caretPositionFromPoint?: (x: number, y: number) => { offset: number; offsetNode: Node } | null
  }
  const position = docWithCaretPosition.caretPositionFromPoint?.(clientX, clientY)
  if (position?.offsetNode.nodeType === Node.TEXT_NODE) {
    return {
      node: position.offsetNode as Text,
      offset: position.offset,
    }
  }

  const docWithCaretRange = document as unknown as {
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  const range = docWithCaretRange.caretRangeFromPoint?.(clientX, clientY)
  if (range?.startContainer.nodeType === Node.TEXT_NODE) {
    return {
      node: range.startContainer as Text,
      offset: range.startOffset,
    }
  }

  return null
}

export function BlockNoteEditor({ note, onChange, onOpenWikiLink }: BlockNoteEditorProps) {
  const editorRootRef = useRef<HTMLDivElement | null>(null)
  const initialContent = useMemo(() => parseBlocks(note.content), [note.content])

  const editor = useCreateBlockNote(
    {
      initialContent,
    },
    [note.id],
  )
  useInlineCodeRunner(editor, editorRootRef, note.id)

  const handleEditorChange = useCallback(() => {
    onChange(note.id, [...editor.document])
    requestAnimationFrame(highlightWikiLinks)
  }, [editor, note.id, onChange])

  const handleEditorClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const textPosition = getTextPositionFromPoint(event.clientX, event.clientY)
    if (!textPosition || !event.currentTarget.contains(textPosition.node)) {
      return
    }

    const wikiLink = getWikiLinkAtTextOffset(textPosition.node.textContent ?? '', textPosition.offset)
    if (!wikiLink) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onOpenWikiLink(wikiLink.title)
  }, [onOpenWikiLink])

  useEffect(() => {
    requestAnimationFrame(highlightWikiLinks)
    return () => {
      const cssWithHighlights = CSS as CssWithHighlights
      cssWithHighlights.highlights?.delete('trace-wiki-link')
    }
  }, [note.id])

  return (
    <div ref={editorRootRef} onClick={handleEditorClick}>
      <BlockNoteView editor={editor} onChange={handleEditorChange} theme={traceBlockNoteTheme} />
    </div>
  )
}
