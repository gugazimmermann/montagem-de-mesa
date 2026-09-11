import type {
  Categoria,
  Cliente,
  DadosCliente,
  ItemMesa,
  PadraoTecido,
} from '../compartilhado/tipos'
import { mesclarToalhasFixas } from './categoriasFixas'
import { supabase } from './supabase'

type ClienteRow = {
  id: string
  slug: string
  email: string
  nome: string
  logo: string
}

type CategoriaRow = {
  id: string
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

function mapCliente(row: ClienteRow): Cliente {
  return {
    id: row.id,
    slug: row.slug,
    email: row.email,
    nome: row.nome,
    logo: row.logo,
  }
}

function mapCategoria(row: CategoriaRow): Categoria {
  return {
    id: row.id,
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

export function slugify(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugifyCategoria(rotulo: string): string {
  return slugify(rotulo) || `categoria-${Date.now()}`
}

export async function obterClientePorId(id: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, slug, email, nome, logo')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ? mapCliente(data) : null
}

export async function obterClientePorSlug(slug: string): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, slug, email, nome, logo')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw error
  return data ? mapCliente(data) : null
}

export async function obterClientePorAuthUserId(
  authUserId: string,
): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from('clientes')
    .select('id, slug, email, nome, logo')
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
  if (existente) return existente

  const meta = user.user_metadata ?? {}
  const email = (user.email ?? '').trim().toLowerCase()
  const nomeMeta = typeof meta.nome === 'string' ? meta.nome.trim() : ''
  const nome = nomeMeta || (email ? email.split('@')[0]! : '')
  const slugMeta = typeof meta.slug === 'string' ? meta.slug.trim() : ''
  const slug = slugify(slugMeta || nome)

  if (!nome || !slug || !email) return null

  const { data: row, error } = await supabase
    .from('clientes')
    .insert({
      id: slug,
      auth_user_id: user.id,
      slug,
      email,
      nome,
      logo: '',
    })
    .select('id, slug, email, nome, logo')
    .single()

  if (!error && row) return mapCliente(row)

  // Concorrência / já criado no intervalo
  return obterClientePorAuthUserId(user.id)
}

export async function entrar(email: string, senha: string): Promise<Cliente | null> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: senha,
  })

  if (error || !data.user) return null

  const cliente = await garantirClienteParaUsuario(data.user)
  if (!cliente) {
    await supabase.auth.signOut()
    return null
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

export async function cadastrar(dados: {
  nome: string
  email: string
  senha: string
}): Promise<Cliente> {
  const nome = dados.nome.trim()
  const email = dados.email.trim().toLowerCase()
  const slug = slugify(nome)

  if (!nome) throw new CadastroErro('Informe o nome do cliente.')
  if (!slug) throw new CadastroErro('Informe um nome válido para gerar o identificador.')
  if (!email) throw new CadastroErro('Informe o e-mail.')
  if (dados.senha.length < 6) {
    throw new CadastroErro('A senha deve ter pelo menos 6 caracteres.')
  }

  const [{ data: porSlug }, { data: porEmail }] = await Promise.all([
    supabase.from('clientes').select('id').eq('slug', slug).maybeSingle(),
    supabase.from('clientes').select('id').eq('email', email).maybeSingle(),
  ])

  if (porSlug) {
    throw new CadastroErro('Já existe um cliente com este nome. Escolha outro.')
  }
  if (porEmail) {
    throw new CadastroErro('Já existe um cliente com este e-mail.')
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
    throw new CadastroErro(
      authError.message.includes('already registered')
        ? 'Este e-mail já está cadastrado.'
        : 'Não foi possível criar a conta. Tente novamente.',
    )
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

export async function sair(): Promise<void> {
  await supabase.auth.signOut()
}

export async function obterSessaoCliente(): Promise<Cliente | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.user) return null
  return garantirClienteParaUsuario(data.session.user)
}

export function ouvirSessao(
  callback: (cliente: Cliente | null) => void,
): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_evento, session) => {
    void (async () => {
      if (!session?.user) {
        callback(null)
        return
      }
      try {
        const cliente = await garantirClienteParaUsuario(session.user)
        callback(cliente)
      } catch {
        callback(null)
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
      .select('id, rotulo, descricao, ordem')
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

export async function atualizarPerfil(
  clienteId: string,
  perfil: { nome: string; logo: string },
): Promise<void> {
  const { error } = await supabase
    .from('clientes')
    .update({
      nome: perfil.nome,
      logo: perfil.logo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clienteId)

  if (error) throw error
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
