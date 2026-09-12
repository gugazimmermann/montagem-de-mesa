import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  clienteTemAcesso,
  diasRestantesTrial,
  type StatusAssinatura,
} from '../../compartilhado/tipos'
import {
  abrirPortalAssinatura,
  assinaturaPagaAtiva,
  cancelarAssinatura,
  formatarValorFatura,
  formatarDescricaoFaturaPtBr,
  iniciarCheckoutAssinatura,
  listarFaturasPagas,
  statusEfetivoAssinatura,
  sincronizarAssinatura,
  sincronizarAssinaturaComRetry,
  type AssinaturaStripeResumo,
  type FaturaPaga,
} from '../../dados/assinaturaStripe'
import { obterSessaoCliente } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import { AdminConfirmacao } from './AdminConfirmacao'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function rotuloStatus(status: string): string {
  switch (status) {
    case 'trialing':
      return 'Período de avaliação'
    case 'active':
      return 'Assinatura ativa'
    case 'past_due':
      return 'Pagamento pendente'
    case 'canceled':
      return 'Cancelada'
    case 'unpaid':
      return 'Não paga'
    case 'incomplete':
      return 'Incompleta'
    default:
      return status
  }
}

function mapStatusLocal(status: string): StatusAssinatura {
  switch (status) {
    case 'active':
    case 'past_due':
    case 'canceled':
    case 'unpaid':
    case 'incomplete':
    case 'trialing':
      return status
    default:
      return 'trialing'
  }
}

export function AssinaturaAdmin() {
  const navegar = useNavigate()
  const [params, setParams] = useSearchParams()
  const { cliente, definirCliente, sair, carregando } = useAuth()
  const [erro, setErro] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [atualizandoAposCheckout, setAtualizandoAposCheckout] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [faturas, setFaturas] = useState<FaturaPaga[]>([])
  const [resumoStripe, setResumoStripe] = useState<AssinaturaStripeResumo | null>(
    null,
  )
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [erroHistorico, setErroHistorico] = useState<string | null>(null)
  const checkoutProcessadoRef = useRef<string | null>(null)
  const syncStaleFeitoRef = useRef(false)
  const carregarHistoricoRef = useRef<() => Promise<void>>(async () => {})

  const refrescarCliente = useCallback(async () => {
    const sessao = await obterSessaoCliente()
    if (sessao) definirCliente(sessao)
    return sessao
  }, [definirCliente])

  const carregarHistorico = useCallback(async () => {
    if (!cliente?.stripeCustomerId) {
      setFaturas([])
      setResumoStripe(null)
      setErroHistorico(null)
      return
    }

    setCarregandoHistorico(true)
    setErroHistorico(null)
    try {
      const resultado = await listarFaturasPagas()
      setFaturas(resultado.faturas)
      setResumoStripe(resultado.assinatura)

      // listar-faturas pode ter sincronizado o DB; atualiza sessão se mudou
      if (
        resultado.subscriptionStatus &&
        resultado.subscriptionStatus !== cliente.subscriptionStatus
      ) {
        await refrescarCliente()
      }
    } catch (e) {
      setErroHistorico(
        e instanceof Error ? e.message : 'Não foi possível carregar o histórico.',
      )
    } finally {
      setCarregandoHistorico(false)
    }
  }, [
    cliente?.stripeCustomerId,
    cliente?.subscriptionStatus,
    refrescarCliente,
  ])

  carregarHistoricoRef.current = carregarHistorico

  useEffect(() => {
    void carregarHistorico()
  }, [carregarHistorico])

  // Conta já paga no Stripe mas DB ainda trialing → sync uma vez
  useEffect(() => {
    if (!cliente?.stripeCustomerId || syncStaleFeitoRef.current) return
    const precisaSync =
      cliente.subscriptionStatus === 'trialing' || !cliente.stripeSubscriptionId
    if (!precisaSync) return

    syncStaleFeitoRef.current = true
    void (async () => {
      try {
        const sync = await sincronizarAssinatura()
        if (sync.assinatura) setResumoStripe(sync.assinatura)
        if (sync.synced) {
          await refrescarCliente()
          await carregarHistoricoRef.current()
        }
      } catch {
        // silencioso: histórico / webhook podem cobrir depois
      }
    })()
  }, [
    cliente?.stripeCustomerId,
    cliente?.subscriptionStatus,
    cliente?.stripeSubscriptionId,
    refrescarCliente,
  ])

  useEffect(() => {
    const checkout = params.get('checkout')
    if (!checkout) return
    if (checkoutProcessadoRef.current === checkout) return
    checkoutProcessadoRef.current = checkout

    setParams({}, { replace: true })

    if (checkout === 'sucesso') {
      setErro(null)
      setOk('Pagamento recebido. Atualizando sua assinatura…')
      setAtualizandoAposCheckout(true)
      void (async () => {
        try {
          const sync = await sincronizarAssinaturaComRetry(3, 1500)
          if (sync.assinatura) setResumoStripe(sync.assinatura)
          await refrescarCliente()
          setOk('Assinatura atualizada. Você já pode usar o painel.')
        } catch {
          setOk(
            'Pagamento enviado. Se o status ainda mostrar avaliação, aguarde alguns segundos e atualize a página.',
          )
        } finally {
          setAtualizandoAposCheckout(false)
          void carregarHistoricoRef.current()
        }
      })()
      return
    }

    if (checkout === 'cancelado') {
      setOk(null)
      setErro('Checkout cancelado. Você pode tentar novamente quando quiser.')
    }
  }, [params, setParams, refrescarCliente])

  async function aoAssinar() {
    setErro(null)
    setOk(null)
    setOcupado(true)
    try {
      const url = await iniciarCheckoutAssinatura()
      window.location.assign(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o checkout.')
      setOcupado(false)
    }
  }

  async function aoGerenciar() {
    setErro(null)
    setOk(null)
    setOcupado(true)
    try {
      const url = await abrirPortalAssinatura()
      window.location.assign(url)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o portal.')
      setOcupado(false)
    }
  }

  async function aoConfirmarCancelamento() {
    setConfirmarCancelar(false)
    setErro(null)
    setOk(null)
    setOcupado(true)
    try {
      const resultado = await cancelarAssinatura()
      setResumoStripe({
        status: resultado.status ?? 'active',
        cancelAtPeriodEnd: Boolean(resultado.cancelAtPeriodEnd),
        currentPeriodEnd: resultado.currentPeriodEnd ?? null,
      })
      await refrescarCliente()
      setOk(
        resultado.currentPeriodEnd
          ? `Assinatura cancelada. Você mantém o acesso até ${formatarData(resultado.currentPeriodEnd)}.`
          : 'Assinatura cancelada ao fim do período atual.',
      )
      await carregarHistorico()
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível cancelar a assinatura.',
      )
    } finally {
      setOcupado(false)
    }
  }

  async function aoSair() {
    await sair()
    navegar('/admin', { replace: true })
  }

  if (carregando) {
    return <AdminPainelCarregando mensagem="Carregando assinatura…" />
  }

  if (!cliente) {
    return <AdminSessaoInvalida />
  }

  const statusEfetivo = statusEfetivoAssinatura(
    cliente.subscriptionStatus,
    resumoStripe,
  )
  const statusEfetivoLocal = mapStatusLocal(statusEfetivo)
  const pagaAtiva = assinaturaPagaAtiva(statusEfetivo)
  const temAcesso =
    clienteTemAcesso({
      subscriptionStatus: statusEfetivoLocal,
      trialEndsAt: cliente.trialEndsAt,
    }) || pagaAtiva
  const diasTrial = diasRestantesTrial({
    subscriptionStatus: statusEfetivoLocal,
    trialEndsAt: cliente.trialEndsAt,
  })
  const temStripe = Boolean(cliente.stripeCustomerId)
  const temSubscription = Boolean(
    cliente.stripeSubscriptionId || resumoStripe,
  )
  const cancelamentoAgendado = Boolean(resumoStripe?.cancelAtPeriodEnd)
  const periodoFim =
    resumoStripe?.currentPeriodEnd ?? cliente.currentPeriodEnd
  const mostrarTrial = statusEfetivo === 'trialing' && !pagaAtiva
  const mostrarAssinar = !pagaAtiva && (mostrarTrial || !temAcesso)
  const podeCancelar =
    temSubscription &&
    pagaAtiva &&
    !cancelamentoAgendado &&
    statusEfetivo !== 'canceled'

  const alerta = (
    <>
      {ok ? (
        <AdminAlerta tipo="success" titulo="Pronto">
          {ok}
        </AdminAlerta>
      ) : null}
      {erro ? (
        <AdminAlerta tipo="error" titulo="Atenção">
          {erro}
        </AdminAlerta>
      ) : null}
      {!temAcesso ? (
        <AdminAlerta tipo="error" titulo="Acesso bloqueado">
          Seu período de avaliação acabou ou a assinatura não está ativa. Assine para
          liberar o painel e a página pública <code>/{cliente.slug}</code>.
        </AdminAlerta>
      ) : null}
      {cancelamentoAgendado && periodoFim ? (
        <AdminAlerta tipo="warning" titulo="Cancelamento agendado">
          Sua assinatura não será renovada. O acesso continua até{' '}
          <strong>{formatarData(periodoFim)}</strong>.
        </AdminAlerta>
      ) : null}
    </>
  )

  return (
    <>
      <AdminPaginaPainel
        titulo="Assinatura"
        breadcrumb={[
          { rotulo: 'Painel', para: temAcesso ? '/admin/painel' : undefined },
          { rotulo: 'Assinatura' },
        ]}
        acoes={
          temAcesso ? (
            <Link className="btn btn--ghost" to="/admin/painel">
              Voltar ao painel
            </Link>
          ) : (
            <button type="button" className="btn btn--ghost" onClick={() => void aoSair()}>
              Sair
            </button>
          )
        }
        alerta={alerta}
      >
        <section className="admin-painel__secao admin-assinatura__secao">
          <h2>Status atual</h2>
          <p className="admin-assinatura__intro">
            Gerencie o período de avaliação e a cobrança recorrente da sua montagem.
          </p>

          <dl className="admin-assinatura__lista">
            <div>
              <dt>Status</dt>
              <dd>{rotuloStatus(statusEfetivo)}</dd>
            </div>
            {mostrarTrial ? (
              <div>
                <dt>Trial até</dt>
                <dd>
                  {formatarData(cliente.trialEndsAt)}
                  {diasTrial != null
                    ? ` (${diasTrial} dia${diasTrial === 1 ? '' : 's'})`
                    : ''}
                </dd>
              </div>
            ) : null}
            {periodoFim ? (
              <div>
                <dt>
                  {cancelamentoAgendado ? 'Acesso até' : 'Próxima renovação'}
                </dt>
                <dd>{formatarData(periodoFim)}</dd>
              </div>
            ) : null}
          </dl>

          {!temStripe ? (
            <p className="admin-assinatura__aviso-stripe">
              Ainda não há cobrança Stripe vinculada a esta conta. Ao assinar, o
              histórico de pagamentos e o cancelamento passam a aparecer aqui.
            </p>
          ) : null}

          <div className="admin-assinatura__acoes">
            {mostrarAssinar ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={ocupado || atualizandoAposCheckout}
                onClick={() => void aoAssinar()}
              >
                {ocupado ? 'Abrindo checkout…' : 'Assinar agora'}
              </button>
            ) : null}
            {temStripe ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={ocupado || atualizandoAposCheckout}
                onClick={() => void aoGerenciar()}
              >
                {ocupado ? 'Abrindo portal…' : 'Gerenciar cobrança'}
              </button>
            ) : null}
            {podeCancelar ? (
              <button
                type="button"
                className="btn btn--danger"
                disabled={ocupado || atualizandoAposCheckout}
                onClick={() => setConfirmarCancelar(true)}
              >
                Cancelar assinatura
              </button>
            ) : null}
          </div>
        </section>

        <section className="admin-painel__secao admin-assinatura__secao">
          <h2>Pagamentos anteriores</h2>
          {!temStripe ? (
            <AdminEstadoVazio
              titulo="Nenhum pagamento registrado"
              descricao="Quando houver faturas pagas no Stripe, elas aparecerão nesta lista."
            />
          ) : carregandoHistorico ? (
            <p className="admin-assinatura__carregando" role="status">
              Carregando histórico…
            </p>
          ) : erroHistorico ? (
            <AdminAlerta tipo="error" titulo="Histórico">
              {erroHistorico}
            </AdminAlerta>
          ) : faturas.length === 0 ? (
            <AdminEstadoVazio
              titulo="Nenhum pagamento registrado"
              descricao="Ainda não há faturas pagas vinculadas a esta conta."
            />
          ) : (
            <ul className="admin-assinatura__faturas">
              {faturas.map((fatura) => (
                <li key={fatura.id} className="admin-assinatura__fatura">
                  <div>
                    <p className="admin-assinatura__fatura-valor">
                      {formatarValorFatura(fatura.valor, fatura.moeda)}
                    </p>
                    <p className="admin-assinatura__fatura-meta">
                      {formatarData(fatura.pagoEm)}
                      {fatura.descricao
                        ? ` · ${formatarDescricaoFaturaPtBr(fatura.descricao)}`
                        : ''}
                    </p>
                  </div>
                  <div className="admin-assinatura__fatura-links">
                    {fatura.faturaUrl ? (
                      <a
                        className="btn btn--ghost"
                        href={fatura.faturaUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver fatura
                      </a>
                    ) : null}
                    {fatura.pdfUrl ? (
                      <a
                        className="btn btn--ghost"
                        href={fatura.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </AdminPaginaPainel>

      <AdminConfirmacao
        aberto={confirmarCancelar}
        titulo="Cancelar assinatura?"
        descricao={
          periodoFim
            ? `A cobrança deixa de renovar. Você continua com acesso até ${formatarData(periodoFim)}.`
            : 'A cobrança deixa de renovar ao fim do período atual. Você mantém o acesso até essa data.'
        }
        confirmarRotulo="Confirmar cancelamento"
        cancelarRotulo="Manter assinatura"
        perigo
        aoConfirmar={() => void aoConfirmarCancelamento()}
        aoCancelar={() => setConfirmarCancelar(false)}
      />
    </>
  )
}
