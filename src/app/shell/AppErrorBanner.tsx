interface AppErrorBannerProps {
  error: string | null
}

export function AppErrorBanner({ error }: AppErrorBannerProps) {
  if (!error) {
    return null
  }

  return (
    <div className="border-b border-rose-400/30 bg-rose-400/10 px-4 py-2 text-sm text-rose-100">
      {error}
    </div>
  )
}
