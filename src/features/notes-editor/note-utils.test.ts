import { describe, expect, it } from 'vitest'
import {
  EMPTY_NOTE_CONTENT,
  blocksFromPlainText,
  extractPlainTextFromContent,
  extractTitleFromBlocks,
  parseBlocks,
  sanitizeStoredContent,
} from './note-utils'
import type { Block } from '@blocknote/core'

describe('note-utils', () => {
  it('sanitizes empty or invalid stored content to an empty block array', () => {
    expect(sanitizeStoredContent(null)).toBe(EMPTY_NOTE_CONTENT)
    expect(sanitizeStoredContent('')).toBe(EMPTY_NOTE_CONTENT)
    expect(sanitizeStoredContent('not json')).toBe(EMPTY_NOTE_CONTENT)
    expect(sanitizeStoredContent('{"type":"paragraph"}')).toBe(EMPTY_NOTE_CONTENT)
  })

  it('keeps valid block arrays as canonical JSON', () => {
    const stored = sanitizeStoredContent(
      JSON.stringify([
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello Trace' }],
        },
      ]),
    )

    expect(JSON.parse(stored)).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Hello Trace' }],
      },
    ])
  })

  it('normalizes unsupported block types to safe paragraph blocks', () => {
    const blocks = parseBlocks(JSON.stringify([{ type: 'image', content: 'not an image anymore' }]))

    expect(blocks).toEqual([{ type: 'paragraph', content: 'not an image anymore' }])
  })

  it('extracts a title from the first non-empty block', () => {
    const blocks = [
      { type: 'paragraph', content: '' },
      { type: 'heading', content: [{ type: 'text', text: 'Knowledge map' }] },
    ] as unknown as Block[]

    expect(extractTitleFromBlocks(blocks)).toBe('Knowledge map')
  })

  it('round-trips plain text through fallback blocks', () => {
    const blocks = blocksFromPlainText('Line one\nLine two')
    const stored = JSON.stringify(blocks)

    expect(extractPlainTextFromContent(stored)).toBe('Line one\nLine two')
  })
})
