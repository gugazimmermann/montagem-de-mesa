import { Link } from 'react-router-dom'
import { diasRestantesTrial } from '../../compartilhado/tipos'
import { useAuth } from '../autenticacao'
import * as ui from './adminClasses'

function mensagemDias(dias: number): string {
  if (dias <= 0) return 'Avaliação encerrada — assine para liberar o painel.'
  if (dias === 1) return 'Último dia de avaliação.'
  return `Restam ${dias} dias de avaliação.`
}

/** Banner no topo do admin: dias de trial quando não há assinatura paga. */
export function AdminBannerTrial() {
  const { cliente } = useAuth()

  if (!cliente) return null
  if (cliente.subscriptionStatus !== 'trialing') return null
  if (cliente.stripeSubscriptionId) return null

  const dias = diasRestantesTrial(cliente)
  if (dias == null) return null

  return (
    <div className={ui.bannerTrial} role="status">
      <p>{mensagemDias(dias)}</p>
      <Link className="btn btn--ghost" to="/admin/assinatura">
        Assinar
      </Link>
    </div>
  )
}
