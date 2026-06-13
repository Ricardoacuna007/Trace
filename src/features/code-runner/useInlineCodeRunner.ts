import type { Block, BlockNoteEditor } from '@blocknote/core'
import { useCallback, useEffect, useRef, type RefObject } from 'react'
import type { TraceCodeRunnerSettings } from '../../lib/db'
import { snippetFromBlock, type CodeBlockSnippet } from './codeBlocks'
import type { CodeOutput } from './useCodeRunner'
import { useCodeRunner } from './useCodeRunner'

function flattenBlocks(blocks: Block[]): Block[] {
  const flattened: Block[] = []
  for (const block of blocks) {
    flattened.push(block)
    const children = (block as { children?: Block[] }).children
    if (Array.isArray(children) && children.length > 0) {
      flattened.push(...flattenBlocks(children))
    }
  }
  return flattened
}

function blockIdForElement(element: HTMLElement): string | null {
  const container = element.closest<HTMLElement>('[data-node-type="blockContainer"][data-id]')
    ?? element.closest<HTMLElement>('[data-id]')
  return container?.dataset.id ?? null
}

function outputStatus(output: CodeOutput): string {
  if (output.timedOut) {
    return `timeout en ${output.durationMs}ms`
  }
  if (output.status === 0) {
    return `ok en ${output.durationMs}ms`
  }
  return `salida ${output.status ?? 'sin codigo'} en ${output.durationMs}ms`
}

function renderOutput(contentElement: HTMLElement, output: CodeOutput | undefined) {
  contentElement.querySelector(':scope > .trace-code-runner-output')?.remove()
  if (!output) {
    return
  }

  const panel = document.createElement('div')
  panel.className = 'trace-code-runner-output'
  panel.contentEditable = 'false'

  const header = document.createElement('div')
  header.className = 'trace-code-runner-output-header'
  header.textContent = outputStatus(output)
  panel.appendChild(header)

  if (output.stdout) {
    const stdout = document.createElement('pre')
    stdout.className = 'trace-code-runner-output-stdout'
    stdout.textContent = output.stdout
    panel.appendChild(stdout)
  }

  if (output.stderr) {
    const stderr = document.createElement('pre')
    stderr.className = 'trace-code-runner-output-stderr'
    stderr.textContent = output.stderr
    panel.appendChild(stderr)
  }

  contentElement.appendChild(panel)
}

function ensureInlineStyle() {
  const styleId = 'trace-inline-code-runner-style'
  if (document.getElementById(styleId)) {
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .trace-editor .bn-block-content[data-content-type="codeBlock"] {
      border: 1px solid var(--border);
      background: var(--bg2);
      color: var(--t1);
    }

    .trace-editor .bn-block-content[data-content-type="codeBlock"] > pre {
      padding-top: 34px;
    }

    .trace-code-runner-inline {
      align-items: center;
      display: flex;
      gap: 6px;
      position: absolute;
      right: 10px;
      top: 8px;
      z-index: 3;
    }

    .trace-code-runner-inline-button {
      align-items: center;
      background: var(--accent-glow);
      border: 1px solid rgba(94, 139, 255, 0.3);
      border-radius: var(--radius-sm);
      color: var(--accent);
      cursor: pointer;
      display: inline-flex;
      font: 500 10px var(--font);
      height: 24px;
      padding: 0 9px;
      transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
    }

    .trace-code-runner-inline-button:hover {
      background: rgba(94, 139, 255, 0.2);
    }

    .trace-code-runner-inline-button:disabled {
      background: var(--bg3);
      border-color: var(--border);
      color: var(--t3);
      cursor: not-allowed;
    }

    .trace-code-runner-output {
      border-top: 1px solid var(--border);
      margin: 0 14px 14px;
      overflow: hidden;
      border-radius: var(--radius-md);
      background: rgba(0, 0, 0, 0.22);
    }

    .trace-code-runner-output-header {
      border-bottom: 1px solid var(--border);
      color: var(--t3);
      font: 10px var(--mono);
      padding: 6px 8px;
    }

    .trace-code-runner-output-stdout,
    .trace-code-runner-output-stderr {
      margin: 0;
      max-height: 180px;
      overflow: auto;
      padding: 8px;
      white-space: pre-wrap;
      font: 10px/1.55 var(--mono);
    }

    .trace-code-runner-output-stdout {
      color: var(--t1);
    }

    .trace-code-runner-output-stderr {
      border-top: 1px solid var(--border);
      color: var(--red);
    }
  `
  document.head.appendChild(style)
}

function snippetMapFromEditor(editor: BlockNoteEditor): Map<string, CodeBlockSnippet> {
  const snippets = new Map<string, CodeBlockSnippet>()
  flattenBlocks(editor.document as Block[]).forEach((block, index) => {
    const snippet = snippetFromBlock(block, index)
    if (snippet) {
      snippets.set(snippet.id, snippet)
    }
  })
  return snippets
}

export function useInlineCodeRunner(
  editor: BlockNoteEditor,
  rootRef: RefObject<HTMLElement | null>,
  noteId: string,
  settings: TraceCodeRunnerSettings,
) {
  const runner = useCodeRunner(settings)
  const applyingRef = useRef(false)

  const refreshControls = useCallback(() => {
    if (applyingRef.current) {
      return
    }
    const root = rootRef.current
    if (!root) {
      return
    }

    applyingRef.current = true
    ensureInlineStyle()
    try {
      const snippets = snippetMapFromEditor(editor)
      const codeElements = root.querySelectorAll<HTMLElement>('.bn-block-content[data-content-type="codeBlock"]')

      codeElements.forEach((contentElement) => {
        const blockId = blockIdForElement(contentElement)
        const snippet = blockId ? snippets.get(blockId) : undefined
        contentElement.querySelector(':scope > .trace-code-runner-inline')?.remove()
        if (!snippet) {
          renderOutput(contentElement, undefined)
          return
        }

        const controls = document.createElement('div')
        controls.className = 'trace-code-runner-inline'
        controls.contentEditable = 'false'

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'trace-code-runner-inline-button'
        const canRun = runner.canRun(snippet.language)
        const running = runner.isRunning(snippet.id)
        button.disabled = !canRun || running
        button.textContent = running ? 'Running' : 'Run'
        button.title = canRun ? `Ejecutar ${snippet.language}` : `${snippet.language} no disponible`
        button.setAttribute('aria-label', button.title)
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          void runner.runBlock(snippet)
        })

        controls.appendChild(button)
        contentElement.appendChild(controls)
        renderOutput(contentElement, runner.results[snippet.id])
      })
    } finally {
      window.setTimeout(() => {
        applyingRef.current = false
      }, 0)
    }
  }, [editor, rootRef, runner])

  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return undefined
    }

    const frame = window.requestAnimationFrame(refreshControls)
    const observer = new MutationObserver(() => refreshControls())
    observer.observe(root, {
      childList: true,
      subtree: true,
    })

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      root.querySelectorAll('.trace-code-runner-inline, .trace-code-runner-output').forEach((element) => element.remove())
    }
  }, [noteId, refreshControls, rootRef])
}
