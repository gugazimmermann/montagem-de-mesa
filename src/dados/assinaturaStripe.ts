import { supabase } from './supabase'

type RespostaUrl = { url?: string; error?: string }

export type FaturaPaga = {
  id: string
  valor: number
  moeda: string
  pagoEm: string | null
  faturaUrl: string | null
  pdfUrl: string | null
  descricao: string
}

export type AssinaturaStripeResumo = {
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

export type SyncAssinaturaResultado = {
  synced: boolean
  patch: {
    stripe_subscription_id: string | null
    stripe_customer_id: string | null
    subscription_status: string
    current_period_end: string | null
  } | null
  assinatura: AssinaturaStripeResumo | null
}

type RespostaFaturas = {
  faturas?: FaturaPaga[]
  assinatura?: AssinaturaStripeResumo | null
  subscriptionStatus?: string
  stripeSubscriptionId?: string | null
  currentPeriodEnd?: string | null
  error?: string
}

type RespostaCancelar = {
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
  status?: string
  error?: string
}

type RespostaSync = SyncAssinaturaResultado & { error?: string }

async function garantirSessao(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Sessão expirada. Entre novamente.')
  }
}

async function chamarFuncaoBilling(nome: 'criar-checkout' | 'criar-portal'): Promise<string> {
  await garantirSessao()

  const { data, error } = await supabase.functions.invoke<RespostaUrl>(nome, {
    method: 'POST',
  })

  if (error) {
    throw new Error(error.message || 'Falha ao contatar o serviço de cobrança.')
  }

  if (!data?.url) {
    throw new Error(data?.error || 'Resposta inválida do serviço de cobrança.')
  }

  return data.url
}

export async function iniciarCheckoutAssinatura(): Promise<string> {
  return chamarFuncaoBilling('criar-checkout')
}

export async function abrirPortalAssinatura(): Promise<string> {
  return chamarFuncaoBilling('criar-portal')
}

export async function cancelarAssinatura(): Promise<RespostaCancelar> {
  await garantirSessao()

  const { data, error } = await supabase.functions.invoke<RespostaCancelar>(
    'cancelar-assinatura',
    { method: 'POST' },
  )

  if (error) {
    throw new Error(error.message || 'Não foi possível cancelar a assinatura.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return data ?? {}
}

export async function sincronizarAssinatura(): Promise<SyncAssinaturaResultado> {
  await garantirSessao()

  const { data, error } = await supabase.functions.invoke<RespostaSync>(
    'sincronizar-assinatura',
    { method: 'POST' },
  )

  if (error) {
    throw new Error(error.message || 'Não foi possível sincronizar a assinatura.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    synced: Boolean(data?.synced),
    patch: data?.patch ?? null,
    assinatura: data?.assinatura ?? null,
  }
}

/** Tenta sincronizar até ficar active/past_due ou esgotar tentativas. */
export async function sincronizarAssinaturaComRetry(
  tentativas = 3,
  intervaloMs = 1500,
): Promise<SyncAssinaturaResultado> {
  let ultimo: SyncAssinaturaResultado = {
    synced: false,
    patch: null,
    assinatura: null,
  }

  for (let i = 0; i < tentativas; i += 1) {
    ultimo = await sincronizarAssinatura()
    const status = ultimo.patch?.subscription_status ?? ultimo.assinatura?.status
    if (status === 'active' || status === 'past_due') {
      return ultimo
    }
    if (i < tentativas - 1) {
      await new Promise((r) => setTimeout(r, intervaloMs))
    }
  }

  return ultimo
}

export async function listarFaturasPagas(): Promise<{
  faturas: FaturaPaga[]
  assinatura: AssinaturaStripeResumo | null
  subscriptionStatus?: string
  stripeSubscriptionId?: string | null
  currentPeriodEnd?: string | null
}> {
  await garantirSessao()

  const { data, error } = await supabase.functions.invoke<RespostaFaturas>(
    'listar-faturas',
    { method: 'POST' },
  )

  if (error) {
    throw new Error(error.message || 'Não foi possível carregar o histórico.')
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  return {
    faturas: data?.faturas ?? [],
    assinatura: data?.assinatura ?? null,
    subscriptionStatus: data?.subscriptionStatus,
    stripeSubscriptionId: data?.stripeSubscriptionId,
    currentPeriodEnd: data?.currentPeriodEnd,
  }
}

export function formatarValorFatura(centavos: number, moeda: string): string {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: moeda || 'BRL',
    }).format(centavos / 100)
  } catch {
    return `${(centavos / 100).toFixed(2)} ${moeda}`
  }
}

/** Converte descrições do Stripe (ex.: "at R$ 49.90 / month") para pt-BR. */
export function formatarDescricaoFaturaPtBr(descricao: string): string {
  return descricao
    .replace(/\(at\s+/gi, '(')
    .replace(/\bmonths?\b/gi, 'mês')
    .replace(/\byears?\b/gi, 'ano')
    .replace(/\bweeks?\b/gi, 'semana')
    .replace(/\bdays?\b/gi, 'dia')
    .replace(/R\$\s*(\d+)\.(\d{2})/g, 'R$ $1,$2')
    .replace(/\s+\/\s+/g, ' / ')
    .trim()
}

export function statusEfetivoAssinatura(
  statusCliente: string,
  resumo: AssinaturaStripeResumo | null,
): string {
  if (resumo?.status) return resumo.status
  return statusCliente
}

export function assinaturaPagaAtiva(status: string): boolean {
  return status === 'active' || status === 'past_due'
}
