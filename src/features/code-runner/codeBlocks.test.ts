import { describe, expect, it } from 'vitest'
import type { Block } from '@blocknote/core'
import { extractCodeBlocks, snippetFromBlock } from './codeBlocks'

describe('extractCodeBlocks', () => {
  it('extracts executable snippets from block content', () => {
    const snippets = extractCodeBlocks(JSON.stringify([
      {
        id: 'block-a',
        type: 'codeBlock',
        props: { language: 'python' },
        content: 'print("trace")',
      },
      {
        type: 'paragraph',
        content: 'not code',
        children: [
          {
            type: 'codeBlock',
            props: { language: 'js' },
            content: [{ type: 'text', text: 'console.log("nested")' }],
          },
        ],
      },
      {
        type: 'codeBlock',
        props: { language: 'bash' },
        content: '   ',
      },
    ]))

    expect(snippets).toEqual([
      {
        id: 'block-a',
        language: 'python',
        code: 'print("trace")',
        label: 'python #1',
      },
      {
        id: 'code-2',
        language: 'js',
        code: 'console.log("nested")',
        label: 'js #2',
      },
    ])
  })

  it('returns an empty list for invalid content', () => {
    expect(extractCodeBlocks('not json')).toEqual([])
  })

  it('creates a snippet from a BlockNote code block', () => {
    const block = {
      id: 'runtime-block',
      type: 'codeBlock',
      props: { language: 'javascript' },
      content: [{ type: 'text', text: 'console.log("trace")' }],
    } as unknown as Block

    expect(snippetFromBlock(block)).toEqual({
      id: 'runtime-block',
      language: 'javascript',
      code: 'console.log("trace")',
      label: 'javascript #1',
    })
  })
})
