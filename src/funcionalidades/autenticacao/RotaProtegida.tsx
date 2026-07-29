import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './useAuth'

interface PropsRotaProtegida {
  children: ReactNode
}

export function RotaProtegida({ children }: PropsRotaProtegida) {
  const localizacao = useLocation()
  const { cliente, carregando } = useAuth()

  if (carregando) {
    return (
      <div className="admin-login">
        <p className="admin-login__header">Carregando sessão…</p>
      </div>
    )
  }

  if (!cliente) {
    return <Navigate to="/admin" replace state={{ from: localizacao.pathname }} />
  }

  return children
}
