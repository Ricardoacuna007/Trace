import { useCallback, useEffect, useMemo, useState } from 'react'
import { isTauri } from '../../lib/env'
import type { CodeBlockSnippet } from './codeBlocks'

export interface RuntimeInfo {
  language: string
  command: string
  path: string
}

export interface CodeOutput {
  stdout: string
  stderr: string
  status: number | null
  timedOut: boolean
  durationMs: number
  truncated: boolean
}

interface CodeRunnerState {
  canRun: (language: string) => boolean
  detectionError: string | null
  isDesktop: boolean
  isRunning: (blockId: string) => boolean
  results: Record<string, CodeOutput>
  runBlock: (block: CodeBlockSnippet) => Promise<void>
  runtimes: RuntimeInfo[]
}

const TRUST_KEY = 'trace-code-runner-confirmed'

const LANGUAGE_ALIASES = new Map<string, string>([
  ['js', 'javascript'],
  ['node', 'javascript'],
  ['py', 'python'],
  ['python3', 'python'],
  ['rs', 'rust'],
  ['sh', 'bash'],
  ['shell', 'bash'],
  ['ps1', 'powershell'],
  ['pwsh', 'powershell'],
])

function normalizeLanguage(language: string): string {
  const normalized = language.trim().toLowerCase()
  return LANGUAGE_ALIASES.get(normalized) ?? normalized
}

function hasExecutionTrust(): boolean {
  try {
    return window.localStorage.getItem(TRUST_KEY) === '1'
  } catch {
    return false
  }
}

function setExecutionTrust() {
  try {
    window.localStorage.setItem(TRUST_KEY, '1')
  } catch {
    // Ignore unavailable storage; the user will be asked again next time.
  }
}

function confirmExecution(): boolean {
  if (hasExecutionTrust()) {
    return true
  }

  const accepted = window.confirm(
    'Este bloque ejecutara codigo en tu maquina con tus permisos de usuario. Ejecuta solo codigo que entiendas.',
  )
  if (accepted) {
    setExecutionTrust()
  }
  return accepted
}

export function useCodeRunner(): CodeRunnerState {
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([])
  const [results, setResults] = useState<Record<string, CodeOutput>>({})
  const [runningBlockId, setRunningBlockId] = useState<string | null>(null)
  const [detectionError, setDetectionError] = useState<string | null>(null)
  const isDesktop = isTauri()

  useEffect(() => {
    let active = true

    async function loadRuntimes() {
      if (!isDesktop) {
        setRuntimes([])
        setDetectionError(null)
        return
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const nextRuntimes = await invoke<RuntimeInfo[]>('detect_runtimes')
        if (active) {
          setRuntimes(nextRuntimes)
          setDetectionError(null)
        }
      } catch (error) {
        if (active) {
          setDetectionError(error instanceof Error ? error.message : 'No se pudieron detectar runtimes.')
        }
      }
    }

    void loadRuntimes()

    return () => {
      active = false
    }
  }, [isDesktop])

  const runtimeLanguages = useMemo(() => new Set(runtimes.map((runtime) => runtime.language)), [runtimes])

  const canRun = useCallback((language: string) => (
    runtimeLanguages.has(normalizeLanguage(language))
  ), [runtimeLanguages])

  const runBlock = useCallback(async (block: CodeBlockSnippet) => {
    if (!isDesktop) {
      setResults((current) => ({
        ...current,
        [block.id]: {
          stdout: '',
          stderr: 'La ejecucion de codigo solo esta disponible en Trace Desktop.',
          status: null,
          timedOut: false,
          durationMs: 0,
          truncated: false,
        },
      }))
      return
    }

    if (!canRun(block.language)) {
      setResults((current) => ({
        ...current,
        [block.id]: {
          stdout: '',
          stderr: `${block.language} no esta instalado o no esta en PATH.`,
          status: null,
          timedOut: false,
          durationMs: 0,
          truncated: false,
        },
      }))
      return
    }

    if (!confirmExecution()) {
      return
    }

    setRunningBlockId(block.id)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const output = await invoke<CodeOutput>('run_code_block', {
        language: block.language,
        code: block.code,
        timeoutMs: 30_000,
      })
      setResults((current) => ({
        ...current,
        [block.id]: output,
      }))
    } catch (error) {
      setResults((current) => ({
        ...current,
        [block.id]: {
          stdout: '',
          stderr: error instanceof Error ? error.message : 'No se pudo ejecutar el bloque.',
          status: null,
          timedOut: false,
          durationMs: 0,
          truncated: false,
        },
      }))
    } finally {
      setRunningBlockId(null)
    }
  }, [canRun, isDesktop])

  return {
    canRun,
    detectionError,
    isDesktop,
    isRunning: (blockId) => runningBlockId === blockId,
    results,
    runBlock,
    runtimes,
  }
}
