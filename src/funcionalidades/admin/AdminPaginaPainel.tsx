import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminAlerta, AdminBreadcrumb, AdminEstadoCarregando } from './AdminFeedback'

type PropsAdminPaginaPainel = {
  titulo: ReactNode
  breadcrumb?: { rotulo: string; para?: string }[]
  acoes?: ReactNode
  /** Link “Voltar” padrão se `acoes` omitido */
  voltarPara?: string
  voltarRotulo?: string
  alerta?: ReactNode
  children: ReactNode
}

export function AdminPaginaPainel({
  titulo,
  breadcrumb,
  acoes,
  voltarPara,
  voltarRotulo = 'Voltar',
  alerta,
  children,
}: PropsAdminPaginaPainel) {
  const acoesFinais =
    acoes ??
    (voltarPara ? (
      <Link className="btn btn--ghost" to={voltarPara}>
        {voltarRotulo}
      </Link>
    ) : null)

  return (
    <div className="admin-painel">
      <header className="admin-painel__header">
        <div>
          {breadcrumb && breadcrumb.length > 0 ? (
            <AdminBreadcrumb itens={breadcrumb} />
          ) : null}
          <h1>{titulo}</h1>
        </div>
        {acoesFinais ? <div className="admin-painel__acoes">{acoesFinais}</div> : null}
      </header>
      {alerta}
      {children}
    </div>
  )
}

export function AdminSessaoInvalida() {
  return (
    <div className="admin-painel">
      <AdminAlerta tipo="error">Sessão inválida.</AdminAlerta>
    </div>
  )
}

export function AdminPainelCarregando({
  mensagem = 'Carregando…',
}: {
  mensagem?: string
}) {
  return (
    <div className="admin-painel">
      <AdminEstadoCarregando mensagem={mensagem} />
    </div>
  )
}

export function AdminAlertaErro({ children }: { children: ReactNode }) {
  return <AdminAlerta tipo="error">{children}</AdminAlerta>
}
