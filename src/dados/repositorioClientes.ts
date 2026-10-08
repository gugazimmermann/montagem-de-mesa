import type {
  Categoria,
  Cliente,
  DadosCliente,
  ItemMesa,
  PadraoTecido,
  StatusAssinatura,
} from '../compartilhado/tipos'
import { normalizarHexCor } from '../compartilhado/identidadeLoja'
import { CadastroErro } from './erros'
import { mesclarToalhasFixas } from './categoriasFixas'
import { resolverUrlsAssinadasEmLote } from './storage'
import { supabase } from './supabase'
import { gerarSlug, ehSlugReservado } from './slug'
import { normalizarWhatsapp } from './whatsapp'

export {
  digitosWhatsappNacional,
  formatarWhatsapp,
  normalizarWhatsapp,
} from './whatsapp'
export { gerarSlug, ehSlugReservado } from './slug'

export {
  CadastroErro,
  CadastroPendenteConfirmacao,
  EntrarErro,
} from './erros'

export {
  atualizarCategoria,
  atualizarItem,
  criarCategoria,
  criarItem,
  excluirCategoriaDb,
  excluirItemDb,
  trocarOrdemCategoria,
  trocarOrdemItem,
} from './repositorioCatalogo'

export {
  atualizarSenha,
  cadastrar,
  entrar,
  obterSessaoAuthPresente,
  obterSessaoCliente,
  ouvirSessao,
  ouvirSessaoAuth,
  reenviarEmailConfirmacao,
  sair,
  sessaoExigeRedefinirSenha,
  solicitarRedefinicaoSenha,
} from './repositorioAuth'

export const CAMPOS_CLIENTE =
  'id, slug, email, nome, logo, whatsapp, cor_marca, cor_fundo, subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, updated_at'

export type ClienteRow = {
  id: string
  slug: string
  email: string
  nome: string
  logo: string
  whatsapp?: string | null
  cor_marca?: string | null
  cor_fundo?: string | null
  subscription_status?: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  updated_at?: string | null
}

type CategoriaRow = {
  id: string
  codigo: string | null
  rotulo: string
  descricao: string
  ordem: number
}

type ItemRow = {
  id: string
  categoria_id: string
  nome: string
  imagem: string | null
  imagem_catalogo?: string | null
  cores: ItemMesa['cores']
  largura: number | null
  comprimento: number | null
  padrao: string | null
  descricao: string | null
  ordem: number
}

function mapStatus(status: string | null | undefined): StatusAssinatura {
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

export function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    slug: row.slug,
    email: row.email,
    nome: row.nome,
    logo: row.logo,
    whatsapp: row.whatsapp ?? '',
    corMarca: row.cor_marca ?? '',
    corFundo: row.cor_fundo ?? '',
    subscriptionStatus: mapStatus(row.subscription_status),
    trialEndsAt: row.trial_ends_at ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

function mapCategoria(row: CategoriaRow): Categoria {
  return {
    id: row.id,
    codigo: row.codigo,
    rotulo: row.rotulo,
    descricao: row.descricao,
  }
}

function mapItem(row: ItemRow): ItemMesa {
  const item: ItemMesa = {
    id: row.id,
    nome: row.nome,
    categoria: row.categoria_id,
    cores: row.cores,
  }
  if (row.imagem) item.imagem = row.imagem
  if (row.imagem_catalogo) item.imagemCatalogo = row.imagem_catalogo
  if (row.largura != null) item.largura = Number(row.largura)
  if (row.comprimento != null) item.comprimento = Number(row.comprimento)
  if (row.padrao) item.padrao = row.padrao as PadraoTecido
  if (row.descricao) item.descricao = row.descricao
  return item
}

export async function obterClientePorId(id: string): Promise<Cliente | null> {
  const { data: proprio, error: erroProprio } = await supabase
    .from('clientes')
    .select(CAMPOS_CLIENTE)
    .eq('id', id)
    .maybeSingle()

  if (!erroProprio && proprio) return mapCliente(proprio)

  const data = await obterClientePublico({ id })
  if (!data) return null
  return mapCliente({
    ...data,
    email: '',
    subscription_status: 'active',
  })
}

export async function obterClientePorSlug(slug: string): Promise<Cliente | null> {
  const data = await obterClientePublico({ slug })
  if (!data) return null
  return mapCliente({
    ...data,
    email: '',
    subscription_status: 'active',
  })
}

type ClientePublicoRow = {
  id: string
  slug: string
  nome: string
  logo: string
  whatsapp?: string | null
  cor_marca?: string | null
  cor_fundo?: string | null
}

async function obterClientePublico(chave: {
  slug?: string
  id?: string
}): Promise<ClientePublicoRow | null> {
  const { data, error } = await supabase.rpc('obter_cliente_publico', {
    p_slug: chave.slug ?? null,
    p_id: chave.id ?? null,
  })

  if (error) throw error
  const linha = Array.isArray(data) ? data[0] : data
  if (!linha || typeof linha !== 'object') return null
  return linha as ClientePublicoRow
}

export type StatusClientePublico = {
  existe: boolean
  temAcesso: boolean
  nome: string | null
}

/** Slug existe? Tem acesso? (security definer; sem e-mail). */
export async function statusClientePublico(
  slug: string,
): Promise<StatusClientePublico> {
  const { data, error } = await supabase.rpc('status_cliente_publico', {
    p_slug: slug,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    return { existe: false, temAcesso: false, nome: null }
  }

  return {
    existe: Boolean(row.existe),
    temAcesso: Boolean(row.tem_acesso),
    nome: typeof row.nome === 'string' ? row.nome : null,
  }
}

export async function obterClientePorAuthUserId(
  authUserId: string,
): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select(CAMPOS_CLIENTE)
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (error) throw error
  return data ? mapCliente(data) : null
}

function validarSlugMontagem(
  slug: string,
  mensagens: { vazio?: string; invalido?: string; reservado?: string } = {},
): void {
  if (!slug) {
    throw new CadastroErro(mensagens.vazio ?? 'Informe o endereço da montagem.')
  }
  if (!/[a-z0-9]/.test(slug)) {
    throw new CadastroErro(
      mensagens.invalido ?? 'Informe um endereço da montagem válido.',
    )
  }
  if (ehSlugReservado(slug)) {
    throw new CadastroErro(
      mensagens.reservado ?? 'Este endereço é reservado. Escolha outro.',
    )
  }
}

function lancarSeRateLimit(error: { code?: string; message?: string }): void {
  const msg = (error.message ?? '').toLowerCase()
  if (error.code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
    throw new CadastroErro(
      'Limite de e-mails do Supabase atingido. Aguarde alguns minutos e tente de novo.',
    )
  }
}

export async function carregarDadosCliente(
  id: string,
): Promise<DadosCliente | null> {
  const cliente = await obterClientePorId(id)
  if (!cliente) return null

  const [catsRes, itensRes] = await Promise.all([
    supabase
      .from('categorias')
      .select('id, codigo, rotulo, descricao, ordem')
      .eq('cliente_id', id)
      .is('deleted_at', null)
      .order('ordem', { ascending: true }),
    supabase
      .from('itens')
      .select(
        'id, categoria_id, nome, imagem, imagem_catalogo, cores, largura, comprimento, padrao, descricao, ordem',
      )
      .eq('cliente_id', id)
      .is('deleted_at', null)
      .order('ordem', { ascending: true }),
  ])

  if (catsRes.error) throw catsRes.error
  if (itensRes.error) throw itensRes.error

  const itens = (itensRes.data ?? []).map(mapItem)
  const dados = await renovarUrlsAssinadas({
    nome: cliente.nome,
    logo: cliente.logo,
    corMarca: cliente.corMarca,
    corFundo: cliente.corFundo,
    categorias: (catsRes.data ?? []).map(mapCategoria),
    itens,
  })

  return mesclarToalhasFixas(dados)
}

export type CatalogoPublicoCarregado = {
  existe: boolean
  temAcesso: boolean
  nome: string | null
  clienteId: string | null
  whatsapp: string
  email: string
  corMarca: string
  corFundo: string
  dados: DadosCliente | null
}

type CatalogoPublicoRpc = {
  existe?: boolean
  tem_acesso?: boolean
  nome?: string | null
  cliente?: {
    id?: string
    slug?: string
    nome?: string
    logo?: string
    whatsapp?: string
    email?: string
    cor_marca?: string
    cor_fundo?: string
  } | null
  categorias?: Array<{
    id: string
    codigo?: string | null
    rotulo: string
    descricao: string
    ordem?: number
  }>
  itens?: Array<{
    id: string
    categoria_id: string
    nome: string
    imagem?: string | null
    imagem_catalogo?: string | null
    cores: ItemMesa['cores']
    largura?: number | null
    comprimento?: number | null
    padrao?: string | null
    descricao?: string | null
    ordem?: number
  }>
}

/** Uma RPC: status + cliente público + catálogo (com URLs assinadas). */
export async function carregarCatalogoPublico(
  slug: string,
): Promise<CatalogoPublicoCarregado> {
  const { data, error } = await supabase.rpc('carregar_catalogo_publico', {
    p_slug: slug,
  })

  if (error) throw error

  const payload = (data ?? {}) as CatalogoPublicoRpc
  if (!payload.existe) {
    return {
      existe: false,
      temAcesso: false,
      nome: null,
      clienteId: null,
      whatsapp: '',
      email: '',
      corMarca: '',
      corFundo: '',
      dados: null,
    }
  }

  if (!payload.tem_acesso) {
    return {
      existe: true,
      temAcesso: false,
      nome: typeof payload.nome === 'string' ? payload.nome : null,
      clienteId: payload.cliente?.id ?? null,
      whatsapp: payload.cliente?.whatsapp ?? '',
      email: '',
      corMarca: payload.cliente?.cor_marca ?? '',
      corFundo: payload.cliente?.cor_fundo ?? '',
      dados: null,
    }
  }

  if (!payload.cliente?.id) {
    return {
      existe: true,
      temAcesso: false,
      nome: typeof payload.nome === 'string' ? payload.nome : null,
      clienteId: null,
      whatsapp: '',
      email: '',
      corMarca: '',
      corFundo: '',
      dados: null,
    }
  }

  const categorias = (payload.categorias ?? []).map((c) =>
    mapCategoria({
      id: c.id,
      codigo: c.codigo ?? null,
      rotulo: c.rotulo,
      descricao: c.descricao,
      ordem: c.ordem ?? 0,
    }),
  )
  const itens = (payload.itens ?? []).map((i) =>
    mapItem({
      id: i.id,
      categoria_id: i.categoria_id,
      nome: i.nome,
      imagem: i.imagem ?? null,
      imagem_catalogo: i.imagem_catalogo ?? null,
      cores: i.cores,
      largura: i.largura ?? null,
      comprimento: i.comprimento ?? null,
      padrao: i.padrao ?? null,
      descricao: i.descricao ?? null,
      ordem: i.ordem ?? 0,
    }),
  )

  const dados = await renovarUrlsAssinadas({
    nome: payload.cliente.nome ?? payload.nome ?? '',
    logo: payload.cliente.logo ?? '',
    corMarca: payload.cliente.cor_marca ?? '',
    corFundo: payload.cliente.cor_fundo ?? '',
    categorias,
    itens,
  })

  return {
    existe: true,
    temAcesso: true,
    nome: dados.nome,
    clienteId: payload.cliente.id,
    whatsapp: payload.cliente.whatsapp ?? '',
    email: '',
    corMarca: dados.corMarca,
    corFundo: dados.corFundo,
    dados: mesclarToalhasFixas(dados),
  }
}

export async function renovarUrlsAssinadas(
  dados: DadosCliente,
): Promise<DadosCliente> {
  const entradas: { valor: string; bucket: 'logos' | 'itens' }[] = []
  if (dados.logo) entradas.push({ valor: dados.logo, bucket: 'logos' })
  for (const item of dados.itens) {
    if (item.imagem) entradas.push({ valor: item.imagem, bucket: 'itens' })
    if (item.imagemCatalogo) {
      entradas.push({ valor: item.imagemCatalogo, bucket: 'itens' })
    }
  }

  const mapa = await resolverUrlsAssinadasEmLote(entradas)
  if (entradas.length > 0 && mapa.size === 0) {
    return dados
  }
  const logo = dados.logo ? mapa.get(dados.logo) ?? dados.logo : ''
  const itens = dados.itens.map((item) => {
    const proximo = { ...item }
    if (item.imagem) {
      const assinada = mapa.get(item.imagem)
      if (assinada) proximo.imagem = assinada
    }
    if (item.imagemCatalogo) {
      const assinada = mapa.get(item.imagemCatalogo)
      if (assinada) proximo.imagemCatalogo = assinada
    }
    return proximo
  })

  return { ...dados, logo, itens }
}

/** True se outro cliente já usa este endereço da montagem. */
export async function enderecoMontagemEmUso(
  endereco: string,
  clienteIdAtual?: string,
): Promise<boolean> {
  const slug = gerarSlug(endereco)
  if (!slug) return false

  if (clienteIdAtual) {
    const { data, error } = await supabase.rpc('cliente_slug_em_uso_exceto', {
      p_slug: slug,
      p_cliente_id: clienteIdAtual,
    })
    if (error) throw error
    return Boolean(data)
  }

  const { data, error } = await supabase.rpc('cliente_slug_em_uso', {
    p_slug: slug,
  })
  if (error) throw error
  return Boolean(data)
}

export async function atualizarCadastro(
  clienteId: string,
  dados: {
    nome: string
    slug: string
    logo: string
    whatsapp?: string
    corMarca?: string
    corFundo?: string
  },
): Promise<Cliente> {
  const nome = dados.nome.trim()
  const slug = gerarSlug(dados.slug.trim())
  const logo = dados.logo.trim()
  const whatsapp = normalizarWhatsapp(dados.whatsapp ?? '')
  const corMarca =
    dados.corMarca === undefined ? undefined : normalizarHexCor(dados.corMarca)
  const corFundo =
    dados.corFundo === undefined ? undefined : normalizarHexCor(dados.corFundo)

  if (!nome) throw new CadastroErro('Informe o nome do cliente.')
  if (!dados.slug.trim()) throw new CadastroErro('Informe o endereço da montagem.')
  if (dados.whatsapp?.trim() && whatsapp.length < 12) {
    throw new CadastroErro(
      'Informe um WhatsApp válido com DDD, por exemplo (11) 99999-9999.',
    )
  }
  if (dados.corMarca?.trim() && corMarca === '') {
    throw new CadastroErro('Informe a cor de destaque no formato #RRGGBB.')
  }
  if (dados.corFundo?.trim() && corFundo === '') {
    throw new CadastroErro('Informe a cor de fundo no formato #RRGGBB.')
  }
  validarSlugMontagem(slug)

  if (await enderecoMontagemEmUso(slug, clienteId)) {
    throw new CadastroErro('Este endereço da montagem já está em uso.')
  }

  const patch: Record<string, string> = {
    nome,
    slug,
    logo,
    whatsapp,
    updated_at: new Date().toISOString(),
  }
  if (corMarca !== undefined) patch.cor_marca = corMarca
  if (corFundo !== undefined) patch.cor_fundo = corFundo

  const { data, error } = await supabase
    .from('clientes')
    .update(patch)
    .eq('id', clienteId)
    .select(CAMPOS_CLIENTE)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new CadastroErro('Este endereço da montagem já está em uso.')
    }
    throw new CadastroErro('Não foi possível salvar o cadastro. Tente novamente.')
  }

  return mapCliente(data)
}

export async function solicitarTrocaEmail(
  _clienteId: string,
  novoEmail: string,
  opcoes?: { forcarReenvio?: boolean },
): Promise<void> {
  const email = novoEmail.trim().toLowerCase()
  if (!email) throw new CadastroErro('Informe o e-mail.')

  const { data: userData } = await supabase.auth.getUser()
  const pendente = (userData.user?.new_email ?? '').trim().toLowerCase()
  if (!opcoes?.forcarReenvio && pendente === email) {
    // Já há troca pendente para este endereço — evita segundo e-mail no re-save.
    return
  }

  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${window.location.origin}/admin/painel/cadastro` },
  )

  if (error) {
    lancarSeRateLimit(error)
    // Mensagem genérica: evita enumeração de e-mails via RPC/Auth.
    throw new CadastroErro(
      'Não foi possível solicitar a troca de e-mail. Verifique o endereço ou tente mais tarde.',
    )
  }
}

export async function atualizarPerfil(
  clienteId: string,
  perfil: { nome: string; logo: string },
): Promise<void> {
  const cliente = await obterClientePorId(clienteId)
  if (!cliente) throw new CadastroErro('Cliente não encontrado.')
  await atualizarCadastro(clienteId, {
    nome: perfil.nome,
    slug: cliente.slug,
    logo: perfil.logo,
  })
}
