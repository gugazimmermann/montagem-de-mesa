import { Link } from 'react-router-dom'
import {
  diasRestantesPastDue,
  diasRestantesTrial,
} from '../../compartilhado/tipos'
import { useAuth } from '../autenticacao'
import * as ui from './adminClasses'

function mensagemTrial(dias: number): string {
  if (dias <= 0) return 'Avaliação encerrada — assine para liberar o painel.'
  if (dias === 1) return 'Último dia de avaliação.'
  return `Restam ${dias} dias de avaliação.`
}

function mensagemPastDue(dias: number): string {
  if (dias <= 0) {
    return 'Prazo de regularização encerrado — atualize o pagamento para continuar.'
  }
  if (dias === 1) {
    return 'Último dia da tolerância de pagamento. Atualize o cartão para não perder o acesso.'
  }
  return `Pagamento pendente — restam ${dias} dias de tolerância.`
}

/** Banner no topo do admin: trial ou grace past_due. */
export function AdminBannerTrial() {
  const { cliente } = useAuth()

  if (!cliente) return null

  if (cliente.subscriptionStatus === 'past_due') {
    const dias = diasRestantesPastDue(cliente)
    if (dias == null) return null
    return (
      <div className={ui.bannerTrial} role="status">
        <p>{mensagemPastDue(dias)}</p>
        <Link className="btn btn--ghost" to="/admin/assinatura">
          Regularizar
        </Link>
      </div>
    )
  }

  if (cliente.subscriptionStatus !== 'trialing') return null
  if (cliente.stripeSubscriptionId) return null

  const dias = diasRestantesTrial(cliente)
  if (dias == null) return null

  return (
    <div className={ui.bannerTrial} role="status">
      <p>{mensagemTrial(dias)}</p>
      <Link className="btn btn--ghost" to="/admin/assinatura">
        Assinar
      </Link>
    </div>
  )
}
