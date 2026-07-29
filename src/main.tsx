import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { Rotas } from './aplicacao/Rotas.tsx'
import { AuthProvider } from './funcionalidades/autenticacao'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
