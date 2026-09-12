import { CadastroErro } from '../../dados/repositorioClientes'
import { UploadErro } from '../../dados/storage'

export const SENHA_MIN = 10

/** Rotas de auth/paywall que não devem ser o destino após login com acesso. */
const DESTINOS_POS_LOGIN_IGNORADOS = new Set([
  '/admin',
  '/entrar',
  '/admin/assinatura',
  '/admin/recuperar-senha',
  '/admin/redefinir-senha',
])

/**
 * Destino após login.
 * Sem acesso → sempre assinatura.
 * Com acesso → painel (ou deep link válido do admin, nunca a própria paywall).
 */
export function destinoPosLogin(
  from: unknown,
  opcoes?: { temAcesso?: boolean },
): string {
  if (opcoes?.temAcesso === false) {
    return '/admin/assinatura'
  }

  if (typeof from !== 'string') return '/admin/painel'
  if (
    !/^\/admin(\/[\w./-]*)?$/.test(from) ||
    from.includes('..') ||
    from.includes('//') ||
    from.includes('\\') ||
    DESTINOS_POS_LOGIN_IGNORADOS.has(from)
  ) {
    return '/admin/painel'
  }
  return from
}

export function validarSenhasIguais(senha: string, confirmar: string): string | null {
  if (confirmar && senha !== confirmar) {
    return 'As senhas não coincidem.'
  }
  return null
}

export function mapearErroCadastro(
  e: unknown,
  fallback = 'Não foi possível concluir. Tente novamente.',
): string {
  if (e instanceof CadastroErro) return e.message
  return fallback
}

export function mapearErroUpload(
  e: unknown,
  fallback = 'Não foi possível salvar.',
): string {
  if (e instanceof UploadErro) return e.message
  if (e instanceof CadastroErro) return e.message
  return fallback
}
