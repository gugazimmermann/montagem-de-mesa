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
  subscriptionStatus: StatusAssinatura
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

/** Trial válido ou assinatura active/past_due. */
export function clienteTemAcesso(
  cliente: Pick<Cliente, 'subscriptionStatus' | 'trialEndsAt'>,
): boolean {
  if (
    cliente.subscriptionStatus === 'active' ||
    cliente.subscriptionStatus === 'past_due'
  ) {
    return true
  }
  if (cliente.subscriptionStatus === 'trialing') {
    if (!cliente.trialEndsAt) return false
    return new Date(cliente.trialEndsAt).getTime() > Date.now()
  }
  return false
}

export function diasRestantesTrial(
  cliente: Pick<Cliente, 'subscriptionStatus' | 'trialEndsAt'>,
): number | null {
  if (cliente.subscriptionStatus !== 'trialing' || !cliente.trialEndsAt) {
    return null
  }
  const ms = new Date(cliente.trialEndsAt).getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export interface DadosCliente {
  nome: string
  logo: string
  categorias: Categoria[]
  itens: ItemMesa[]
}

export interface Credenciais {
  email: string
  senha: string
}
