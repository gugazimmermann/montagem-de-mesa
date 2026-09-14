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
