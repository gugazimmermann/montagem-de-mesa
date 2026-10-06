import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { Rotas } from './aplicacao/Rotas.tsx'
import { ErrorBoundary } from './compartilhado/ErrorBoundary'
import { AuthProvider } from './funcionalidades/autenticacao'
import { criarQueryClient } from './funcionalidades/admin/useDadosCliente'

const queryClient = criarQueryClient()

/** Carrega Sentry Browser SDK se VITE_SENTRY_DSN estiver definido. */
function iniciarSentryOpcional() {
  const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim()
  if (!dsn || typeof document === 'undefined') return

  const script = document.createElement('script')
  script.src = 'https://browser.sentry-cdn.com/8.55.0/bundle.min.js'
  script.crossOrigin = 'anonymous'
  script.onload = () => {
    const Sentry = window.Sentry as
      | { init?: (o: Record<string, unknown>) => void }
      | undefined
    Sentry?.init?.({
      dsn,
      tracesSampleRate: 0.1,
      environment: import.meta.env.MODE,
    })
  }
  script.onerror = () => {
    console.warn('Sentry CDN não carregou')
  }
  document.head.appendChild(script)
}

iniciarSentryOpcional()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <Rotas />
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
