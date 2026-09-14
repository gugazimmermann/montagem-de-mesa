export type IdCategoria = string

export type PadraoTecido =
  | 'solid'
  | 'linen'
  | 'stripes'
  | 'gingham'
  | 'damask'
  | 'dots'
  | 'herringbone'
  | 'border'

export interface DimensoesItem {
  largura: number
  comprimento: number
}

export interface ItemMesa {
  id: string
  nome: string
  categoria: IdCategoria
  /** URL pública de foto do produto (ex.: sousplats) */
  imagem?: string
  /** Tokens de cor para o preview quando não há imagem */
  cores: {
    primaria: string
    secundaria?: string
    destaque?: string
  }
  /** Largura em cm (exceto toalhas) */
  largura?: number
  /** Comprimento em cm (exceto toalhas) */
  comprimento?: number
  /** Padrão do tecido para toalhas */
  padrao?: PadraoTecido
  descricao?: string
}

export type ConfiguracaoMesa = Record<string, string | null>

export interface Categoria {
  id: IdCategoria
  /** Chave semântica estável para camadas do preview (ex.: sousplat). */
  codigo?: string | null
  rotulo: string
  descricao: string
}

export type StatusAssinatura =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'

export interface Cliente {
  id: string
  slug: string
  email: string
  nome: string
  logo: string
  /** Número WhatsApp com DDI 55 (somente dígitos). */
  whatsapp: string
  subscriptionStatus: StatusAssinatura
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  updatedAt?: string | null
}

/** Graça de past_due — manter alinhado a `cliente_tem_acesso` no SQL. */
export const GRACA_PAST_DUE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Trial válido, assinatura active com período vigente, ou past_due
 * com graça de 7 dias a partir de currentPeriodEnd (fail-closed se ausente).
 * Espelha `public.cliente_tem_acesso` (migrations 150000–170000).
 */
export function clienteTemAcesso(
  cliente: Pick<
    Cliente,
    'subscriptionStatus' | 'trialEndsAt' | 'currentPeriodEnd'
  >,
  agoraMs: number = Date.now(),
): boolean {
  if (cliente.subscriptionStatus === 'past_due') {
    if (!cliente.currentPeriodEnd) return false
    return (
      new Date(cliente.currentPeriodEnd).getTime() + GRACA_PAST_DUE_MS > agoraMs
    )
  }
  if (cliente.subscriptionStatus === 'active') {
    if (!cliente.currentPeriodEnd) return false
    return new Date(cliente.currentPeriodEnd).getTime() > agoraMs
  }
  if (cliente.subscriptionStatus === 'trialing') {
    if (!cliente.trialEndsAt) return false
    return new Date(cliente.trialEndsAt).getTime() > agoraMs
  }
  return false
}

export function diasRestantesTrial(
  cliente: Pick<Cliente, 'subscriptionStatus' | 'trialEndsAt'>,
  agoraMs: number = Date.now(),
): number | null {
  if (cliente.subscriptionStatus !== 'trialing' || !cliente.trialEndsAt) {
    return null
  }
  const ms = new Date(cliente.trialEndsAt).getTime() - agoraMs
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

/** Dias restantes da graça past_due (null se não aplicável). */
export function diasRestantesPastDue(
  cliente: Pick<Cliente, 'subscriptionStatus' | 'currentPeriodEnd'>,
  agoraMs: number = Date.now(),
): number | null {
  if (cliente.subscriptionStatus !== 'past_due' || !cliente.currentPeriodEnd) {
    return null
  }
  const fim =
    new Date(cliente.currentPeriodEnd).getTime() + GRACA_PAST_DUE_MS
  const ms = fim - agoraMs
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export type StatusLeadMontagem = 'novo' | 'contatado' | 'fechado' | 'arquivado'

export type StatusEmailMontagem = 'pending' | 'sent' | 'failed'

export interface DadosCliente {
  nome: string
  logo: string
  categorias: Categoria[]
  itens: ItemMesa[]
}

export interface ItemMontagemEnviada {
  categoria: string
  nome: string
}

/** Envio de montagem feito por um visitante (histórico do estabelecimento). */
export interface MontagemEnviada {
  id: string
  clienteId: string
  visitanteNome: string
  visitanteEmail: string
  visitanteWhatsapp: string
  visitanteEndereco: string
  visitanteCidade: string
  visitanteEstado: string
  itens: ItemMontagemEnviada[]
  linkMontagem: string
  createdAt: string
  emailStatus: StatusEmailMontagem
  leadStatus: StatusLeadMontagem
  notaInterna: string
}

export interface Credenciais {
  email: string
  senha: string
}
