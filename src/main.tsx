import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import './index.css'
import App from './App.tsx'
import { EnvProvider } from './lib/env'

document.documentElement.classList.add('dark')

function renderFatalError(message: string) {
  const root = document.getElementById('root')
  if (!root) {
    return
  }

  root.innerHTML = `
    <div style="height:100%;display:flex;align-items:center;justify-content:center;padding:24px;color:#fecaca;font-family:'DM Sans',sans-serif;">
      <div style="max-width:720px;width:100%;border:1px solid rgba(248,113,113,.35);background:rgba(127,29,29,.25);border-radius:12px;padding:16px;">
        <h2 style="margin:0 0 8px 0;font-size:18px;">Trace detecto un error al iniciar</h2>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;">${message}</pre>
      </div>
    </div>
  `
}

window.addEventListener('error', (event) => {
  const stack = event.error instanceof Error ? event.error.stack ?? event.error.message : event.message
  renderFatalError(stack || 'Error desconocido de JavaScript')
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason instanceof Error ? event.reason.stack ?? event.reason.message : String(event.reason)
  renderFatalError(reason || 'Promesa rechazada sin manejar')
})

createRoot(document.getElementById('root')!).render(
  <MantineProvider forceColorScheme="dark">
    <EnvProvider>
      <App />
    </EnvProvider>
  </MantineProvider>,
)
