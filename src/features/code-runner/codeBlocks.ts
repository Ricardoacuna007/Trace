import type { Block } from '@blocknote/core'

export interface CodeBlockSnippet {
  id: string
  language: string
  code: string
  label: string
}

function inlineText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (!Array.isArray(value)) {
    return ''
  }

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }
      if (!item || typeof item !== 'object') {
        return ''
      }
      const record = item as Record<string, unknown>
      if (typeof record.text === 'string') {
        return record.text
      }
      return inlineText(record.content)
    })
    .join('')
}

function blockLanguage(props: unknown): string {
  if (!props || typeof props !== 'object') {
    return 'text'
  }
  const language = (props as { language?: unknown }).language
  return typeof language === 'string' && language.trim() ? language.trim().toLowerCase() : 'text'
}

function visitBlocks(blocks: unknown[], snippets: CodeBlockSnippet[]) {
  for (const block of blocks) {
    if (!block || typeof block !== 'object') {
      continue
    }

    const record = block as Record<string, unknown>
    if (record.type === 'codeBlock') {
      const code = inlineText(record.content)
      const language = blockLanguage(record.props)
      const id = typeof record.id === 'string' ? record.id : `code-${snippets.length + 1}`
      snippets.push({
        id,
        language,
        code,
        label: `${language} #${snippets.length + 1}`,
      })
    }

    if (Array.isArray(record.children)) {
      visitBlocks(record.children, snippets)
    }
  }
}

export function snippetFromBlock(block: Block, fallbackIndex = 0): CodeBlockSnippet | null {
  if (block.type !== 'codeBlock') {
    return null
  }

  const code = inlineText((block as { content?: unknown }).content)
  if (!code.trim()) {
    return null
  }

  const props = (block as { props?: unknown }).props
  const language = blockLanguage(props)
  return {
    id: block.id,
    language,
    code,
    label: `${language} #${fallbackIndex + 1}`,
  }
}

export function extractCodeBlocks(content: string): CodeBlockSnippet[] {
  if (!content.trim()) {
    return []
  }

  try {
    const parsed = JSON.parse(content)
    if (!Array.isArray(parsed)) {
      return []
    }
    const snippets: CodeBlockSnippet[] = []
    visitBlocks(parsed, snippets)
    return snippets.filter((snippet) => snippet.code.trim().length > 0)
  } catch {
    return []
  }
}
