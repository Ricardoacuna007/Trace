import { startTransition, useCallback, useDeferredValue, useEffect, useState } from 'react'

interface UseCommandSearchParams {
  clearGlobalSearch: () => void
  runGlobalSearch: (query: string) => Promise<void>
}

export function useCommandSearch({ clearGlobalSearch, runGlobalSearch }: UseCommandSearchParams) {
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const deferredCommandQuery = useDeferredValue(commandQuery)

  useEffect(() => {
    if (!commandOpen) {
      return
    }

    const timer = setTimeout(() => {
      void runGlobalSearch(deferredCommandQuery)
    }, 120)

    return () => clearTimeout(timer)
  }, [commandOpen, deferredCommandQuery, runGlobalSearch])

  const handleCommandOpenChange = useCallback((open: boolean) => {
    setCommandOpen(open)
    if (!open) {
      setCommandQuery('')
      clearGlobalSearch()
    }
  }, [clearGlobalSearch])

  const openCommandPalette = useCallback(() => {
    startTransition(() => setCommandOpen(true))
  }, [])

  return {
    commandOpen,
    commandQuery,
    handleCommandOpenChange,
    openCommandPalette,
    setCommandQuery,
  }
}
