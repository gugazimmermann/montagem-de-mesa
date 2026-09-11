import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { Rotas } from './aplicacao/Rotas.tsx'
import { ErrorBoundary } from './compartilhado/ErrorBoundary'
import { AuthProvider } from './funcionalidades/autenticacao'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <Rotas />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)
