import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminAlerta, AdminBreadcrumb, AdminEstadoSkeleton } from './AdminFeedback'
import './admin-ui.css'
import './PainelAdmin.css'

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
          ) : (
            <p className="admin-painel__eyebrow">Painel do cliente</p>
          )}
          <h1>{titulo}</h1>
        </div>
        {acoesFinais ? <div className="admin-painel__acoes">{acoesFinais}</div> : null}
      </header>
      {alerta ? <div className="admin-alerta-stack">{alerta}</div> : null}
      {children}
    </div>
  )
}

export function AdminSessaoInvalida() {
  return (
    <div className="admin-painel">
      <AdminAlerta tipo="error" titulo="Sessão inválida">
        Faça login novamente para continuar.
      </AdminAlerta>
      <div className="admin-sessao-invalida__acao">
        <Link className="btn btn--primary" to="/admin">
          Entrar
        </Link>
      </div>
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
      <AdminEstadoSkeleton mensagem={mensagem} />
    </div>
  )
}

export function AdminAlertaErro({ children }: { children: ReactNode }) {
  return <AdminAlerta tipo="error">{children}</AdminAlerta>
}
