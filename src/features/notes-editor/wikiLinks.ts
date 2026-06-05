export interface WikiLinkMatch {
  end: number
  start: number
  title: string
}

export function normalizeWikiLinkTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim()
}

export function getWikiLinkAtTextOffset(text: string, offset: number): WikiLinkMatch | null {
  if (!Number.isFinite(offset) || offset < 0) {
    return null
  }

  const matcher = /\[\[([^\]\n]+)\]\]/g
  let match = matcher.exec(text)
  while (match) {
    const start = match.index
    const end = start + match[0].length
    if (offset >= start && offset <= end) {
      const title = normalizeWikiLinkTitle(match[1] ?? '')
      return title.length > 0 ? { start, end, title } : null
    }
    match = matcher.exec(text)
  }

  return null
}
