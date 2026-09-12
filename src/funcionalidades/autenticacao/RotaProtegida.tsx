import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { clienteTemAcesso } from '../../compartilhado/tipos'
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
    const from =
      localizacao.pathname === '/admin/assinatura'
        ? '/admin/painel'
        : localizacao.pathname
    return <Navigate to="/admin" replace state={{ from }} />
  }

  if (
    precisaRedefinirSenha &&
    localizacao.pathname !== '/admin/redefinir-senha'
  ) {
    return <Navigate to="/admin/redefinir-senha" replace />
  }

  const rotaAssinatura = localizacao.pathname === '/admin/assinatura'
  if (!clienteTemAcesso(cliente) && !rotaAssinatura) {
    return <Navigate to="/admin/assinatura" replace />
  }

  return children
}
