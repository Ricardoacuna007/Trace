import { describe, expect, it } from 'vitest'
import { getWikiLinkAtTextOffset, normalizeWikiLinkTitle } from './wikiLinks'

describe('wikiLinks', () => {
  it('normalizes whitespace inside wiki link titles', () => {
    expect(normalizeWikiLinkTitle('  Project   Atlas  ')).toBe('Project Atlas')
  })

  it('returns the wiki link under a text offset', () => {
    const text = 'Open [[Project Atlas]] today'

    expect(getWikiLinkAtTextOffset(text, 9)).toEqual({
      start: 5,
      end: 22,
      title: 'Project Atlas',
    })
  })

  it('ignores offsets outside wiki links', () => {
    expect(getWikiLinkAtTextOffset('Open [[Project Atlas]] today', 1)).toBeNull()
  })
})
