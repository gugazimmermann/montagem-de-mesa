import type {
  Categoria,
  Cliente,
  DadosCliente,
  ItemMesa,
  PadraoTecido,
  StatusAssinatura,
} from '../compartilhado/tipos'
import { CadastroErro, CadastroPendenteConfirmacao, EntrarErro } from './erros'
import { mesclarToalhasFixas } from './categoriasFixas'
import { resolverUrlsAssinadasEmLote } from './storage'
import { supabase } from './supabase'
import {
  META_PRECISA_REDEFINIR_SENHA,
  metadataMarcaRecovery,
} from './authRecovery'

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
} from './repositorioCatalogo'

const CAMPOS_CLIENTE =
  'id, slug, email, nome, logo, whatsapp, subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, updated_at'

type ClienteRow = {
  id: string
  slug: string
  email: string
  nome: string
  logo: string
  whatsapp?: string | null
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

const DDI_BRASIL = '55'

/** DDD + número (até 11 dígitos), sem o 55. */
export function digitosWhatsappNacional(valor: string): string {
  let digitos = valor.replace(/\D/g, '')
  if (digitos.startsWith(DDI_BRASIL) && digitos.length > 11) {
    digitos = digitos.slice(DDI_BRASIL.length)
  }
  return digitos.slice(0, 11)
}

/** Máscara amigável: (11) 99999-9999 */
export function formatarWhatsapp(valor: string): string {
  const digitos = digitosWhatsappNacional(valor)
  if (!digitos) return ''
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`
}

/**
 * Normaliza para armazenamento (E.164 BR sem +): 55 + DDD + número.
 * Vazio se não houver dígitos.
 */
export function normalizarWhatsapp(valor: string): string {
  const nacional = digitosWhatsappNacional(valor)
  if (!nacional) return ''
  return `${DDI_BRASIL}${nacional}`
}

function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    slug: row.slug,
    email: row.email,
    nome: row.nome,
    logo: row.logo,
    whatsapp: row.whatsapp ?? '',
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
  if (row.largura != null) item.largura = Number(row.largura)
  if (row.comprimento != null) item.comprimento = Number(row.comprimento)
  if (row.padrao) item.padrao = row.padrao as PadraoTecido
  if (row.descricao) item.descricao = row.descricao
  return item
}

const SLUGS_RESERVADOS = new Set(['admin', 'entrar', 'cadastro', 'assets', 'c'])

/** Slug URL: apenas a-z, 0-9, hífen e underscore. */
export function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/_{2,}/g, '_')
}

export function ehSlugReservado(slug: string): boolean {
  return SLUGS_RESERVADOS.has(slug)
}

export async function obterClientePorId(id: string): Promise<Cliente | null> {
  const { data: proprio, error: erroProprio } = await supabase
    .from('clientes')
    .select(CAMPOS_CLIENTE)
    .eq('id', id)
    .maybeSingle()

  if (!erroProprio && proprio) return mapCliente(proprio)

  const { data, error } = await supabase
    .from('clientes_publicos')
    .select('id, slug, nome, logo, whatsapp')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapCliente({
    ...data,
    email: '',
    subscription_status: 'active',
  })
}

export async function obterClientePorSlug(slug: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes_publicos')
    .select('id, slug, nome, logo, whatsapp')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return mapCliente({
    ...data,
    email: '',
    subscription_status: 'active',
  })
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

type AuthUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}

async function garantirClienteParaUsuario(
  user: AuthUser,
): Promise<Cliente | null> {
  const existente = await obterClientePorAuthUserId(user.id)
  if (existente) {
    const emailAuth = (user.email ?? '').trim().toLowerCase()
    if (emailAuth && emailAuth !== existente.email) {
      const { data: row, error } = await supabase.rpc(
        'sincronizar_email_cliente_do_auth',
      )
      if (!error && row) {
        const sincronizado = Array.isArray(row) ? row[0] : row
        if (sincronizado) return mapCliente(sincronizado as ClienteRow)
      }
    }
    return existente
  }

  const meta = user.user_metadata ?? {}
  const email = (user.email ?? '').trim().toLowerCase()
  const nomeMeta = typeof meta.nome === 'string' ? meta.nome.trim() : ''
  const nome = nomeMeta || (email ? email.split('@')[0]! : '')
  const slugMeta = typeof meta.slug === 'string' ? meta.slug.trim() : ''
  const slug = gerarSlug(slugMeta || nome)

  if (!nome || !slug || !email) return null

  const tentarInserir = async (slugCandidato: string) =>
    supabase
      .from('clientes')
      .insert({
        id: crypto.randomUUID(),
        auth_user_id: user.id,
        slug: slugCandidato,
        email,
        nome,
        logo: '',
      })
      .select(CAMPOS_CLIENTE)
      .single()

  let slugCandidato = slug
  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    if (ehSlugReservado(slugCandidato)) {
      slugCandidato = `${slug}-${tentativa + 2}`
      continue
    }

    const { data: row, error } = await tentarInserir(slugCandidato)
    if (!error && row) return mapCliente(row)

    if (error?.code === '23505') {
      slugCandidato = `${slug}-${tentativa + 2}`
      continue
    }

    break
  }

  // Concorrência / já criado no intervalo
  return obterClientePorAuthUserId(user.id)
}

export async function entrar(email: string, senha: string): Promise<Cliente | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  })

  if (error || !data.user) {
    const msg = (error?.message ?? '').toLowerCase()
    if (
      error?.code === 'email_not_confirmed' ||
      msg.includes('email not confirmed')
    ) {
      throw new EntrarErro(
        'Confirme seu e-mail pelo link enviado antes de entrar.',
        'email_not_confirmed',
      )
    }
    return null
  }

  const cliente = await garantirClienteParaUsuario(data.user)
  if (!cliente) {
    await supabase.auth.signOut()
    throw new EntrarErro(
      'Conta incompleta. Tente cadastrar de novo ou escolha outro nome.',
      'conta_incompleta',
    )
  }

  // Login com senha prova a conta — limpa marca residual de recovery.
  if (metadataMarcaRecovery(data.user.user_metadata as Record<string, unknown>)) {
    try {
      await supabase.auth.updateUser({
        data: { [META_PRECISA_REDEFINIR_SENHA]: false },
      })
    } catch {
      // ignore
    }
  }

  return cliente
}

const SENHA_MIN_REPO = 10

function validarSenha(senha: string): void {
  if (senha.length < SENHA_MIN_REPO) {
    throw new CadastroErro(`A senha deve ter pelo menos ${SENHA_MIN_REPO} caracteres.`)
  }
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

export async function cadastrar(dados: {
  nome: string
  email: string
  senha: string
}): Promise<Cliente> {
  const nome = dados.nome.trim()
  const email = dados.email.trim().toLowerCase()
  const slug = gerarSlug(nome)

  if (!nome) throw new CadastroErro('Informe o nome do cliente.')
  if (!email) throw new CadastroErro('Informe o e-mail.')
  validarSlugMontagem(slug, {
    vazio: 'Informe um nome válido para gerar o endereço da montagem.',
    invalido: 'Informe um nome válido para gerar o endereço da montagem.',
    reservado: 'Este nome gera um endereço reservado. Escolha outro.',
  })
  validarSenha(dados.senha)

  const { data: slugEmUso, error: erroSlug } = await supabase.rpc(
    'cliente_slug_em_uso',
    { p_slug: slug },
  )

  if (erroSlug) throw erroSlug

  if (slugEmUso) {
    throw new CadastroErro('Este endereço da montagem já está em uso.')
  }

  const redirectAdmin = `${window.location.origin}/admin`

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: dados.senha,
    options: {
      data: { nome, slug },
      emailRedirectTo: redirectAdmin,
    },
  })

  if (authError) {
    // Mensagem genérica: evita oráculo de e-mail para visitantes anônimos.
    throw new CadastroErro('Não foi possível criar a conta. Tente novamente.')
  }

  if (!authData.user) {
    throw new CadastroErro('Não foi possível criar a conta. Tente novamente.')
  }

  // Confirmação de e-mail ativa: sem sessão agora; cliente será criado após o link.
  if (!authData.session) {
    throw new CadastroPendenteConfirmacao()
  }

  const cliente = await garantirClienteParaUsuario(authData.user)
  if (!cliente) {
    await supabase.auth.signOut()
    throw new CadastroErro('Não foi possível salvar o cliente. Tente novamente.')
  }

  return cliente
}

export async function solicitarRedefinicaoSenha(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${window.location.origin}/admin/redefinir-senha`,
    },
  )

  if (error) {
    lancarSeRateLimit(error)
    const msg = error.message.toLowerCase()
    if (msg.includes('redirect') || msg.includes('not allowed')) {
      throw new CadastroErro(
        'Não foi possível enviar o e-mail de redefinição. Tente novamente.',
      )
    }
    throw new CadastroErro(
      'Não foi possível enviar o e-mail de redefinição. Tente novamente.',
    )
  }
}

export async function reenviarEmailConfirmacao(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: `${window.location.origin}/admin`,
    },
  })

  if (error) {
    lancarSeRateLimit(error)
    throw new CadastroErro('Não foi possível reenviar o e-mail. Tente novamente.')
  }
}

export async function atualizarSenha(novaSenha: string): Promise<void> {
  validarSenha(novaSenha)

  const { error } = await supabase.auth.updateUser({
    password: novaSenha,
    data: { [META_PRECISA_REDEFINIR_SENHA]: false },
  })
  if (error) {
    throw new CadastroErro('Não foi possível atualizar a senha. Tente novamente.')
  }

  // Encerra outras sessões (dispositivos) após trocar a senha.
  await supabase.auth.signOut({ scope: 'others' })
}

/** Sessão Auth presente (ex.: após link de recovery), sem mapear cliente. */
export async function obterSessaoAuthPresente(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return false
  return true
}

/** True se user_metadata indica que ainda falta redefinir senha pós-recovery. */
export async function sessaoExigeRedefinirSenha(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return false
  return metadataMarcaRecovery(data.user.user_metadata as Record<string, unknown>)
}

export function ouvirSessaoAuth(
  callback: (temSessao: boolean, evento?: string) => void,
): () => void {
  void obterSessaoAuthPresente().then((tem) => callback(tem))

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((evento, session) => {
    callback(!!session, evento)
  })

  return () => subscription.unsubscribe()
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut()
}

export async function obterSessaoCliente(): Promise<Cliente | null> {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return garantirClienteParaUsuario(data.user)
}

export function ouvirSessao(
  callback: (
    cliente: Cliente | null,
    meta?: {
      evento?: string
      sessaoValida?: boolean
      precisaRedefinirSenha?: boolean
    },
  ) => void,
): () => void {
  let geracao = 0

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((evento, session) => {
    const atual = ++geracao
    void (async () => {
      if (!session?.user) {
        if (atual !== geracao) return
        callback(null, { evento, sessaoValida: false })
        return
      }

      const precisaRedefinir =
        evento === 'PASSWORD_RECOVERY' ||
        metadataMarcaRecovery(session.user.user_metadata as Record<string, unknown>)

      if (evento === 'PASSWORD_RECOVERY' && !metadataMarcaRecovery(session.user.user_metadata as Record<string, unknown>)) {
        // Persiste no user_metadata para sobreviver a limpeza de localStorage.
        try {
          await supabase.auth.updateUser({
            data: { [META_PRECISA_REDEFINIR_SENHA]: true },
          })
        } catch {
          // Continua com flag local mesmo se metadata falhar.
        }
      }

      if (precisaRedefinir) {
        if (atual !== geracao) return
        callback(null, {
          evento,
          sessaoValida: true,
          precisaRedefinirSenha: true,
        })
        return
      }

      try {
        const cliente = await garantirClienteParaUsuario(session.user)
        if (atual !== geracao) return
        // Mantém sessaoValida mesmo se o mapeamento falhar (não “desloga” a UI por erro transitório).
        callback(cliente, {
          evento,
          sessaoValida: true,
          precisaRedefinirSenha: false,
        })
      } catch {
        if (atual !== geracao) return
        callback(null, {
          evento,
          sessaoValida: true,
          precisaRedefinirSenha: false,
        })
      }
    })()
  })

  return () => subscription.unsubscribe()
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
      .order('ordem', { ascending: true }),
    supabase
      .from('itens')
      .select(
        'id, categoria_id, nome, imagem, cores, largura, comprimento, padrao, descricao, ordem',
      )
      .eq('cliente_id', id)
      .order('ordem', { ascending: true }),
  ])

  if (catsRes.error) throw catsRes.error
  if (itensRes.error) throw itensRes.error

  const itens = (itensRes.data ?? []).map(mapItem)
  const dados = await assinarMidiasDadosCliente({
    nome: cliente.nome,
    logo: cliente.logo,
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
      dados: null,
    }
  }

  if (!payload.tem_acesso || !payload.cliente?.id) {
    return {
      existe: true,
      temAcesso: false,
      nome: typeof payload.nome === 'string' ? payload.nome : null,
      clienteId: null,
      whatsapp: '',
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
      cores: i.cores,
      largura: i.largura ?? null,
      comprimento: i.comprimento ?? null,
      padrao: i.padrao ?? null,
      descricao: i.descricao ?? null,
      ordem: i.ordem ?? 0,
    }),
  )

  const dados = await assinarMidiasDadosCliente({
    nome: payload.cliente.nome ?? payload.nome ?? '',
    logo: payload.cliente.logo ?? '',
    categorias,
    itens,
  })

  return {
    existe: true,
    temAcesso: true,
    nome: dados.nome,
    clienteId: payload.cliente.id,
    whatsapp: payload.cliente.whatsapp ?? '',
    dados: mesclarToalhasFixas(dados),
  }
}

async function assinarMidiasDadosCliente(
  dados: DadosCliente,
): Promise<DadosCliente> {
  const entradas: { valor: string; bucket: 'logos' | 'itens' }[] = []
  if (dados.logo) entradas.push({ valor: dados.logo, bucket: 'logos' })
  for (const item of dados.itens) {
    if (item.imagem) entradas.push({ valor: item.imagem, bucket: 'itens' })
  }

  const mapa = await resolverUrlsAssinadasEmLote(entradas)
  const logo = dados.logo ? mapa.get(dados.logo) ?? dados.logo : ''
  const itens = dados.itens.map((item) => {
    if (!item.imagem) return item
    const assinada = mapa.get(item.imagem)
    return assinada ? { ...item, imagem: assinada } : item
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
  dados: { nome: string; slug: string; logo: string; whatsapp?: string },
): Promise<Cliente> {
  const nome = dados.nome.trim()
  const slug = gerarSlug(dados.slug.trim())
  const logo = dados.logo.trim()
  const whatsapp = normalizarWhatsapp(dados.whatsapp ?? '')

  if (!nome) throw new CadastroErro('Informe o nome do cliente.')
  if (!dados.slug.trim()) throw new CadastroErro('Informe o endereço da montagem.')
  if (dados.whatsapp?.trim() && whatsapp.length < 12) {
    throw new CadastroErro(
      'Informe um WhatsApp válido com DDD, por exemplo (11) 99999-9999.',
    )
  }
  validarSlugMontagem(slug)

  if (await enderecoMontagemEmUso(slug, clienteId)) {
    throw new CadastroErro('Este endereço da montagem já está em uso.')
  }

  const { data, error } = await supabase
    .from('clientes')
    .update({
      nome,
      slug,
      logo,
      whatsapp,
      updated_at: new Date().toISOString(),
    })
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
