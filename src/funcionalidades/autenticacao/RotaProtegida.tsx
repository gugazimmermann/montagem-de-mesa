import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AdminAuthCarregando } from '../admin/AdminAuthCard'
import { useAuth } from './useAuth'

interface PropsRotaProtegida {
  children: ReactNode
}

export function RotaProtegida({ children }: PropsRotaProtegida) {
  const localizacao = useLocation()
  const { cliente, carregando, precisaRedefinirSenha } = useAuth()

  if (carregando) {
    return <AdminAuthCarregando mensagem="Carregando sessão…" />
  }

  if (!cliente) {
    return <Navigate to="/admin" replace state={{ from: localizacao.pathname }} />
  }

  if (
    precisaRedefinirSenha &&
    localizacao.pathname !== '/admin/redefinir-senha'
  ) {
    return <Navigate to="/admin/redefinir-senha" replace />
  }

  return children
}
