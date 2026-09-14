import type { Cliente } from '../compartilhado/tipos'
import { CadastroErro, CadastroPendenteConfirmacao, EntrarErro } from './erros'
import {
  META_PRECISA_REDEFINIR_SENHA,
  metadataMarcaRecovery,
} from './authRecovery'
import {
  CAMPOS_CLIENTE,
  mapCliente,
  obterClientePorAuthUserId,
  type ClienteRow,
} from './repositorioClientes'
import { gerarSlug, ehSlugReservado } from './slug'
import { supabase } from './supabase'

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
