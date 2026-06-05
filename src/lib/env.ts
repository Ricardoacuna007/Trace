import { createContext, createElement, useContext, type ReactNode } from 'react'

export interface RuntimeEnv {
  isTauri: boolean
  isWeb: boolean
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function isWeb(): boolean {
  return !isTauri()
}

const EnvContext = createContext<RuntimeEnv>({
  isTauri: false,
  isWeb: true,
})

export function EnvProvider({ children }: { children: ReactNode }) {
  const tauri = isTauri()
  return createElement(
    EnvContext.Provider,
    {
      value: {
        isTauri: tauri,
        isWeb: !tauri,
      },
    },
    children,
  )
}

export function useEnv(): RuntimeEnv {
  return useContext(EnvContext)
}
