import type { Block, PartialBlock } from '@blocknote/core'

const TITLE_MAX_LENGTH = 52
const SAFE_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'quote',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'toggleListItem',
  'codeBlock',
  'divider',
])

export const DEFAULT_NOTE_TITLE = 'Untitled'
export const EMPTY_NOTE_CONTENT = '[]'

export function sanitizeStoredContent(content: string | null | undefined): string {
  if (!content || !content.trim()) {
    return EMPTY_NOTE_CONTENT
  }

  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      return JSON.stringify(parsed)
    }
  } catch {
    return EMPTY_NOTE_CONTENT
  }

  return EMPTY_NOTE_CONTENT
}

function extractInlineText(rawContent: unknown): string {
  if (typeof rawContent === 'string') {
    return rawContent
  }

  if (!Array.isArray(rawContent)) {
    return ''
  }

  return rawContent
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (!item || typeof item !== 'object') {
        return ''
      }

      const maybeText = (item as { text?: unknown }).text
      if (typeof maybeText === 'string') {
        return maybeText
      }

      const maybeContent = (item as { content?: unknown }).content
      if (typeof maybeContent === 'string' || Array.isArray(maybeContent)) {
        return extractInlineText(maybeContent)
      }

      return ''
    })
    .join('')
}

export function extractTitleFromBlocks(blocks: Block[]): string {
  for (const block of blocks) {
    const text = extractInlineText((block as { content?: unknown }).content).trim()
    if (text.length > 0) {
      return text.slice(0, TITLE_MAX_LENGTH)
    }
  }

  return DEFAULT_NOTE_TITLE
}

function normalizePartialBlock(block: unknown): PartialBlock | null {
  if (!block || typeof block !== 'object') {
    return null
  }

  const record = block as Record<string, unknown>
  const type = record.type
  if (typeof type !== 'string' || type.length === 0) {
    return null
  }

  const safeType = SAFE_BLOCK_TYPES.has(type) ? type : 'paragraph'
  const normalized: Record<string, unknown> = { type: safeType }

  if (safeType === type && record.props && typeof record.props === 'object') {
    normalized.props = record.props
  }

  if (typeof record.content === 'string') {
    normalized.content = record.content
  } else if (Array.isArray(record.content)) {
    const inlineText = extractInlineText(record.content)
    if (inlineText.length > 0) {
      normalized.content = inlineText
    }
  }

  if (Array.isArray(record.children)) {
    const children = record.children
      .map((child) => normalizePartialBlock(child))
      .filter((child): child is PartialBlock => child !== null)

    if (children.length > 0) {
      normalized.children = children
    }
  }

  if (safeType !== type && typeof normalized.content !== 'string' && !normalized.children) {
    return null
  }

  return normalized as PartialBlock
}

export function parseBlocks(content: string): PartialBlock[] | undefined {
  if (!content.trim()) {
    return undefined
  }

  try {
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) {
      const normalized = parsed
        .map((block) => normalizePartialBlock(block))
        .filter((block): block is PartialBlock => block !== null)

      if (normalized.length === 0) {
        return undefined
      }

      return normalized
    }
  } catch {
    return undefined
  }

  return undefined
}

function extractTextFromBlock(block: unknown): string {
  if (!block || typeof block !== 'object') {
    return ''
  }

  const content = (block as { content?: unknown }).content
  return extractInlineText(content).trim()
}

export function extractPlainTextFromContent(content: string): string {
  const blocks = parseBlocks(content)
  if (!blocks || blocks.length === 0) {
    return ''
  }

  return blocks
    .map((block) => extractTextFromBlock(block))
    .filter((line) => line.length > 0)
    .join('\n')
}

function paragraphBlock(content: string): PartialBlock {
  return {
    type: 'paragraph',
    content,
  }
}

function headingBlock(content: string): PartialBlock {
  return {
    type: 'heading',
    props: { level: 2 },
    content,
  }
}

function codeBlock(content: string, language?: string): PartialBlock {
  const block: PartialBlock = {
    type: 'codeBlock',
    content,
  }
  if (language) {
    block.props = { language }
  }
  return block
}

function isListLine(value: string): boolean {
  return /^[-*]\s+/.test(value) || /^\d+\.\s+/.test(value)
}

function stripCodeIndent(value: string): string {
  if (value.startsWith('\t')) {
    return value.slice(1)
  }
  if (value.startsWith('    ')) {
    return value.slice(4)
  }
  return value
}

export function blocksFromPlainText(text: string): Block[] {
  const lines = text.replace(/\r/g, '').split('\n')
  const nonEmpty = lines.length > 0 ? lines : ['']
  const blocks: PartialBlock[] = []
  let index = 0

  while (index < nonEmpty.length) {
    const line = nonEmpty[index] ?? ''
    const trimmed = line.trim()
    const nextLine = nonEmpty[index + 1]

    const fencedCode = trimmed.match(/^```([a-z0-9_-]+)?$/i)
    if (fencedCode) {
      const codeLines: string[] = []
      index += 1

      while (index < nonEmpty.length && (nonEmpty[index] ?? '').trim() !== '```') {
        codeLines.push(nonEmpty[index] ?? '')
        index += 1
      }

      if (index < nonEmpty.length) {
        index += 1
      }

      blocks.push(codeBlock(codeLines.join('\n'), fencedCode[1]))
      continue
    }

    if (/^( {4}|\t)/.test(line)) {
      const codeLines: string[] = []

      while (index < nonEmpty.length && (/^( {4}|\t)/.test(nonEmpty[index] ?? '') || (nonEmpty[index] ?? '').trim() === '')) {
        codeLines.push(stripCodeIndent(nonEmpty[index] ?? ''))
        index += 1
      }

      blocks.push(codeBlock(codeLines.join('\n')))
      continue
    }

    if (
      trimmed.length > 0 &&
      trimmed.length < 60 &&
      nextLine !== undefined &&
      nextLine.trim() === '' &&
      !isListLine(trimmed)
    ) {
      blocks.push(headingBlock(trimmed))
      index += 2
      continue
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (bulletMatch) {
      blocks.push({
        type: 'bulletListItem',
        content: bulletMatch[1],
      })
      index += 1
      continue
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (numberedMatch) {
      blocks.push({
        type: 'numberedListItem',
        content: numberedMatch[1],
      })
      index += 1
      continue
    }

    blocks.push(paragraphBlock(line))
    index += 1
  }

  return blocks as unknown as Block[]
}
