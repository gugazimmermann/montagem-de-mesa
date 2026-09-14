import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AdminAlerta, AdminBreadcrumb, AdminEstadoSkeleton } from './AdminFeedback'
import { AdminBannerTrial } from './AdminBannerTrial'
import * as ui from './adminClasses'

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
    <div className={ui.painel}>
      <AdminBannerTrial />
      <header className={ui.painelHeader}>
        <div>
          {breadcrumb && breadcrumb.length > 0 ? (
            <AdminBreadcrumb itens={breadcrumb} />
          ) : (
            <p className={ui.painelEyebrow}>Painel do cliente</p>
          )}
          <h1 className={ui.painelTitulo}>{titulo}</h1>
        </div>
        {acoesFinais ? <div className={ui.painelAcoes}>{acoesFinais}</div> : null}
      </header>
      {alerta ? <div className={ui.alertaStack}>{alerta}</div> : null}
      {children}
    </div>
  )
}

export function AdminSessaoInvalida() {
  return (
    <div className={ui.painel}>
      <AdminAlerta tipo="error" titulo="Sessão inválida">
        Faça login novamente para continuar.
      </AdminAlerta>
      <div className="mt-4">
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
    <div className={ui.painel}>
      <AdminEstadoSkeleton mensagem={mensagem} />
    </div>
  )
}

export function AdminAlertaErro({ children }: { children: ReactNode }) {
  return <AdminAlerta tipo="error">{children}</AdminAlerta>
}
