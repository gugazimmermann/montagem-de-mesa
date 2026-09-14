import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  clienteTemAcesso,
  diasRestantesPastDue,
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
  sincronizarAssinaturaComRetry,
  type AssinaturaStripeResumo,
  type FaturaPaga,
} from '../../dados/assinaturaStripe'
import { obterSessaoCliente } from '../../dados/repositorioClientes'
import { rastrear } from '../../compartilhado/observabilidade'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import { AdminConfirmacao } from './AdminConfirmacao'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import * as ui from './adminClasses'

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
  const [acaoOcupada, setAcaoOcupada] = useState<
    null | 'checkout' | 'portal' | 'cancelar'
  >(null)
  const [atualizandoAposCheckout, setAtualizandoAposCheckout] = useState(false)
  const [confirmarCancelar, setConfirmarCancelar] = useState(false)
  const [faturas, setFaturas] = useState<FaturaPaga[]>([])
  const [resumoStripe, setResumoStripe] = useState<AssinaturaStripeResumo | null>(
    null,
  )
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [erroHistorico, setErroHistorico] = useState<string | null>(null)
  const checkoutProcessadoRef = useRef<string | null>(null)
  const carregarHistoricoRef = useRef<() => Promise<void>>(async () => {})
  const checkoutTimeoutRef = useRef<number | null>(null)

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

  // Voltar do Stripe (bfcache / back) deixa acaoOcupada preso em "checkout".
  useEffect(() => {
    function aoPageShow() {
      setAcaoOcupada((atual) => (atual === 'checkout' ? null : atual))
    }
    window.addEventListener('pageshow', aoPageShow)
    return () => {
      window.removeEventListener('pageshow', aoPageShow)
      if (checkoutTimeoutRef.current != null) {
        window.clearTimeout(checkoutTimeoutRef.current)
        checkoutTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const checkout = params.get('checkout')
    if (!checkout) return
    if (checkoutProcessadoRef.current === checkout) return
    checkoutProcessadoRef.current = checkout

    setParams({}, { replace: true })
    setAcaoOcupada(null)

    if (checkout === 'sucesso') {
      setErro(null)
      setOk('Pagamento recebido. Atualizando sua assinatura…')
      setAtualizandoAposCheckout(true)
      void (async () => {
        try {
          const sync = await sincronizarAssinaturaComRetry(3, 1500)
          if (sync.assinatura) setResumoStripe(sync.assinatura)
          const sessao = await refrescarCliente()
          rastrear('checkout_success', {})
          if (sessao && clienteTemAcesso(sessao)) {
            setOk('Assinatura atualizada. Redirecionando ao painel…')
            navegar('/admin/painel', {
              replace: true,
              state: { flash: 'Assinatura ativa. Bem-vindo de volta ao painel.' },
            })
            return
          }
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
  }, [params, setParams, refrescarCliente, navegar])

  async function aoAssinar() {
    setErro(null)
    setOk(null)
    setAcaoOcupada('checkout')
    try {
      const url = await iniciarCheckoutAssinatura()
      window.location.assign(url)
      // Se a navegação não descarregar a página (bloqueio / bfcache), libera os botões.
      if (checkoutTimeoutRef.current != null) {
        window.clearTimeout(checkoutTimeoutRef.current)
      }
      checkoutTimeoutRef.current = window.setTimeout(() => {
        checkoutTimeoutRef.current = null
        setAcaoOcupada((atual) => (atual === 'checkout' ? null : atual))
      }, 2500)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o checkout.')
      setAcaoOcupada(null)
    }
  }

  async function aoGerenciar() {
    setErro(null)
    setOk(null)
    setAcaoOcupada('portal')
    const portal = window.open('about:blank', '_blank')
    try {
      const url = await abrirPortalAssinatura()
      if (!portal) {
        setErro(
          'Não foi possível abrir o portal. Permita pop-ups neste site e tente novamente.',
        )
      } else {
        portal.opener = null
        portal.location.assign(url)
      }
    } catch (e) {
      portal?.close()
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir o portal.')
    } finally {
      setAcaoOcupada(null)
    }
  }

  async function aoConfirmarCancelamento() {
    if (acaoOcupada) return
    setErro(null)
    setOk(null)
    setAcaoOcupada('cancelar')
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
      setConfirmarCancelar(false)
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível cancelar a assinatura.',
      )
      setConfirmarCancelar(false)
    } finally {
      setAcaoOcupada(null)
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
  const temStripe = Boolean(cliente.stripeCustomerId)
  const temSubscription = Boolean(
    cliente.stripeSubscriptionId || resumoStripe,
  )
  const cancelamentoAgendado = Boolean(resumoStripe?.cancelAtPeriodEnd)
  const periodoFim =
    resumoStripe?.currentPeriodEnd ?? cliente.currentPeriodEnd
  const temAcesso = clienteTemAcesso({
    subscriptionStatus: statusEfetivoLocal,
    trialEndsAt: cliente.trialEndsAt,
    currentPeriodEnd: periodoFim ?? cliente.currentPeriodEnd,
  })
  const diasTrial = diasRestantesTrial({
    subscriptionStatus: statusEfetivoLocal,
    trialEndsAt: cliente.trialEndsAt,
  })
  const diasPastDue = diasRestantesPastDue({
    subscriptionStatus: statusEfetivoLocal,
    currentPeriodEnd: periodoFim ?? cliente.currentPeriodEnd,
  })
  const mostrarTrial = statusEfetivo === 'trialing' && !pagaAtiva
  const mostrarAssinar = !temAcesso || mostrarTrial
  const podeCancelar =
    temSubscription &&
    pagaAtiva &&
    !cancelamentoAgendado &&
    statusEfetivo !== 'canceled'

  const temAlerta =
    Boolean(ok) ||
    Boolean(erro) ||
    !temAcesso ||
    Boolean(cancelamentoAgendado && periodoFim) ||
    (statusEfetivoLocal === 'past_due' && diasPastDue != null)

  const alerta = temAlerta ? (
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
      {statusEfetivoLocal === 'past_due' && diasPastDue != null ? (
        <AdminAlerta tipo="warning" titulo="Pagamento pendente">
          {diasPastDue <= 0
            ? 'A tolerância de 7 dias encerrou. Atualize o pagamento no portal para recuperar o acesso.'
            : `Você tem ${diasPastDue} dia${diasPastDue === 1 ? '' : 's'} de tolerância. Regularize o pagamento para não perder o painel e a página pública.`}
        </AdminAlerta>
      ) : null}
      {!temAcesso ? (
        <AdminAlerta tipo="error" titulo="Acesso bloqueado">
          {statusEfetivoLocal === 'trialing'
            ? 'Seu período de avaliação acabou. Assine para liberar o painel, o histórico de montagens e a página pública.'
            : 'O período da assinatura encerrou ou ela não está ativa. Assine novamente para liberar o painel, o histórico de montagens e a página pública.'}{' '}
          Endereço público: <code>/{cliente.slug}</code>.
        </AdminAlerta>
      ) : null}
      {cancelamentoAgendado && periodoFim ? (
        <AdminAlerta tipo="warning" titulo="Cancelamento agendado">
          Sua assinatura não será renovada. O acesso continua até{' '}
          <strong>{formatarData(periodoFim)}</strong>.
        </AdminAlerta>
      ) : null}
    </>
  ) : null

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
        <section className={ui.assinaturaSecao}>
          <h2>Status atual</h2>
          <p className={ui.assinaturaIntro}>
            Gerencie o período de avaliação e a cobrança recorrente da sua montagem.
          </p>

          <dl className={ui.assinaturaLista}>
            <div className={ui.assinaturaListaItem}>
              <dt className={ui.assinaturaDt}>Status</dt>
              <dd className={ui.assinaturaDd}>{rotuloStatus(statusEfetivo)}</dd>
            </div>
            {mostrarTrial ? (
              <div className={ui.assinaturaListaItem}>
                <dt className={ui.assinaturaDt}>Trial até</dt>
                <dd className={ui.assinaturaDd}>
                  {formatarData(cliente.trialEndsAt)}
                  {diasTrial != null
                    ? ` (${diasTrial} dia${diasTrial === 1 ? '' : 's'})`
                    : ''}
                </dd>
              </div>
            ) : null}
            {periodoFim ? (
              <div className={ui.assinaturaListaItem}>
                <dt className={ui.assinaturaDt}>
                  {cancelamentoAgendado ? 'Acesso até' : 'Próxima renovação'}
                </dt>
                <dd className={ui.assinaturaDd}>{formatarData(periodoFim)}</dd>
              </div>
            ) : null}
          </dl>

          {!temStripe ? (
            <p className={ui.assinaturaAviso}>
              Ainda não há cobrança vinculada a esta conta. Ao assinar, o
              histórico de pagamentos e o cancelamento passam a aparecer aqui.
            </p>
          ) : null}

          <div className={ui.assinaturaAcoes}>
            {mostrarAssinar ? (
              <button
                type="button"
                className="btn btn--primary"
                disabled={acaoOcupada !== null || atualizandoAposCheckout}
                onClick={() => void aoAssinar()}
              >
                {acaoOcupada === 'checkout' ? 'Abrindo checkout…' : 'Assinar agora'}
              </button>
            ) : null}
            {temStripe ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={acaoOcupada !== null || atualizandoAposCheckout}
                onClick={() => void aoGerenciar()}
              >
                {acaoOcupada === 'portal' ? 'Abrindo portal…' : 'Gerenciar cobrança'}
              </button>
            ) : null}
            {podeCancelar ? (
              <button
                type="button"
                className="btn btn--danger-soft"
                disabled={acaoOcupada !== null || atualizandoAposCheckout}
                onClick={() => setConfirmarCancelar(true)}
              >
                Cancelar assinatura
              </button>
            ) : null}
          </div>
        </section>

        <section className={ui.assinaturaSecao}>
          <h2>Pagamentos anteriores</h2>
          {!temStripe ? (
            <AdminEstadoVazio
              titulo="Nenhum pagamento registrado"
              descricao="Quando houver faturas pagas, elas aparecerão nesta lista."
            />
          ) : carregandoHistorico ? (
            <p className={ui.assinaturaCarregando} role="status">
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
            <ul className={ui.assinaturaFaturas}>
              {faturas.map((fatura) => (
                <li key={fatura.id} className={ui.assinaturaFatura}>
                  <div>
                    <p className={ui.assinaturaFaturaValor}>
                      {formatarValorFatura(fatura.valor, fatura.moeda)}
                    </p>
                    <p className={ui.assinaturaFaturaMeta}>
                      {formatarData(fatura.pagoEm)}
                      {fatura.descricao
                        ? ` · ${formatarDescricaoFaturaPtBr(fatura.descricao)}`
                        : ''}
                    </p>
                  </div>
                  <div className={ui.assinaturaFaturaLinks}>
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
        processando={acaoOcupada === 'cancelar'}
        processandoRotulo="Cancelando…"
        perigo
        aoConfirmar={() => void aoConfirmarCancelamento()}
        aoCancelar={() => {
          if (acaoOcupada !== 'cancelar') setConfirmarCancelar(false)
        }}
      />
    </>
  )
}
