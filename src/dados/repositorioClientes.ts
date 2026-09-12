import type {
  Categoria,
  Cliente,
  DadosCliente,
  ItemMesa,
  PadraoTecido,
  StatusAssinatura,
} from '../compartilhado/tipos'
import { v4 as uuidv4 } from 'uuid'
import { mesclarToalhasFixas } from './categoriasFixas'
import { supabase } from './supabase'

const CAMPOS_CLIENTE =
  'id, slug, email, nome, logo, subscription_status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id'

type ClienteRow = {
  id: string
  slug: string
  email: string
  nome: string
  logo: string
  subscription_status?: string | null
  trial_ends_at?: string | null
  current_period_end?: string | null
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
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

function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    slug: row.slug,
    email: row.email,
    nome: row.nome,
    logo: row.logo,
    subscriptionStatus: mapStatus(row.subscription_status),
    trialEndsAt: row.trial_ends_at ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    stripeCustomerId: row.stripe_customer_id ?? null,
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
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
    .select('id, slug, nome, logo')
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
    .select('id, slug, nome, logo')
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
        id: uuidv4(),
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

export class EntrarErro extends Error {
  codigo?: 'email_not_confirmed' | 'credenciais' | 'conta_incompleta'

  constructor(
    message: string,
    codigo?: 'email_not_confirmed' | 'credenciais' | 'conta_incompleta',
  ) {
    super(message)
    this.name = 'EntrarErro'
    this.codigo = codigo
  }
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
  return cliente
}

export class CadastroErro extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CadastroErro'
  }
}

/** Conta Auth criada; falta confirmar e-mail antes de haver sessão/cliente. */
export class CadastroPendenteConfirmacao extends CadastroErro {
  constructor() {
    super(
      'Conta criada. Confirme o e-mail pelo link enviado; em seguida você será direcionado ao admin.',
    )
    this.name = 'CadastroPendenteConfirmacao'
  }
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

  const { error } = await supabase.auth.updateUser({ password: novaSenha })
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
    meta?: { evento?: string; sessaoValida?: boolean },
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
      try {
        const cliente = await garantirClienteParaUsuario(session.user)
        if (atual !== geracao) return
        // Mantém sessaoValida mesmo se o mapeamento falhar (não “desloga” a UI por erro transitório).
        callback(cliente, { evento, sessaoValida: true })
      } catch {
        if (atual !== geracao) return
        callback(null, { evento, sessaoValida: true })
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

  const dados: DadosCliente = {
    nome: cliente.nome,
    logo: cliente.logo,
    categorias: (catsRes.data ?? []).map(mapCategoria),
    itens: (itensRes.data ?? []).map(mapItem),
  }

  return mesclarToalhasFixas(dados)
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
  dados: { nome: string; slug: string; logo: string },
): Promise<Cliente> {
  const nome = dados.nome.trim()
  const slug = gerarSlug(dados.slug.trim())
  const logo = dados.logo.trim()

  if (!nome) throw new CadastroErro('Informe o nome do cliente.')
  if (!dados.slug.trim()) throw new CadastroErro('Informe o endereço da montagem.')
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
  clienteId: string,
  novoEmail: string,
  opcoes?: { forcarReenvio?: boolean },
): Promise<void> {
  const email = novoEmail.trim().toLowerCase()
  if (!email) throw new CadastroErro('Informe o e-mail.')

  const { data: emailEmUso, error: erroEmail } = await supabase.rpc(
    'cliente_email_em_uso_exceto',
    { p_email: email, p_cliente_id: clienteId },
  )

  if (erroEmail) throw erroEmail
  if (emailEmUso) {
    throw new CadastroErro('Já existe um cliente com este e-mail.')
  }

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
    const msg = error.message.toLowerCase()
    if (
      msg.includes('sending email') ||
      msg.includes('email change') ||
      error.code === 'unexpected_failure' ||
      error.code === 'email_address_not_authorized'
    ) {
      throw new CadastroErro(
        'Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.',
      )
    }
    throw new CadastroErro(
      'Não foi possível solicitar a troca de e-mail. Tente novamente.',
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

export async function criarCategoria(
  clienteId: string,
  categoria: Categoria,
): Promise<void> {
  const { count } = await supabase
    .from('categorias')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)

  const { error } = await supabase.from('categorias').insert({
    cliente_id: clienteId,
    id: categoria.id,
    codigo: categoria.codigo ?? null,
    rotulo: categoria.rotulo,
    descricao: categoria.descricao,
    ordem: count ?? 0,
  })

  if (error) throw error
}

export async function atualizarCategoria(
  clienteId: string,
  categoria: Categoria,
): Promise<void> {
  const { error } = await supabase
    .from('categorias')
    .update({
      rotulo: categoria.rotulo,
      descricao: categoria.descricao,
    })
    .eq('cliente_id', clienteId)
    .eq('id', categoria.id)

  if (error) throw error
}

export async function excluirCategoriaDb(
  clienteId: string,
  categoriaId: string,
): Promise<void> {
  const { error } = await supabase
    .from('categorias')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('id', categoriaId)

  if (error) throw error
}

export async function criarItem(clienteId: string, item: ItemMesa): Promise<void> {
  const { count } = await supabase
    .from('itens')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('categoria_id', item.categoria)

  const { error } = await supabase.from('itens').insert({
    cliente_id: clienteId,
    id: item.id,
    categoria_id: item.categoria,
    nome: item.nome,
    imagem: item.imagem ?? null,
    cores: item.cores,
    largura: item.largura ?? null,
    comprimento: item.comprimento ?? null,
    padrao: item.padrao ?? null,
    descricao: item.descricao ?? null,
    ordem: count ?? 0,
  })

  if (error) throw error
}

export async function atualizarItem(clienteId: string, item: ItemMesa): Promise<void> {
  const { error } = await supabase
    .from('itens')
    .update({
      nome: item.nome,
      imagem: item.imagem ?? null,
      cores: item.cores,
      largura: item.largura ?? null,
      comprimento: item.comprimento ?? null,
      padrao: item.padrao ?? null,
      descricao: item.descricao ?? null,
      categoria_id: item.categoria,
    })
    .eq('cliente_id', clienteId)
    .eq('id', item.id)

  if (error) throw error
}

export async function excluirItemDb(clienteId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from('itens')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('id', itemId)

  if (error) throw error
}
