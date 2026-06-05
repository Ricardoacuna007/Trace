import { ThemeInjector } from './ThemeInjector'

interface AppLoadingProps {
  configJson: string
  customCss: string
}

export function AppLoading({ configJson, customCss }: AppLoadingProps) {
  return (
    <main className="flex h-full flex-col">
      <ThemeInjector configJson={configJson} customCss={customCss} />
      <div className="flex flex-1 items-center justify-center text-sm text-trace-muted">
        Cargando estructura local...
      </div>
    </main>
  )
}
