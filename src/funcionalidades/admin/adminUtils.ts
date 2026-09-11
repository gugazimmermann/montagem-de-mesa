import { CadastroErro } from '../../dados/repositorioClientes'
import { UploadErro } from '../../dados/storage'

export const SENHA_MIN = 10

export function destinoPosLogin(from: unknown): string {
  if (typeof from !== 'string') return '/admin/painel'
  if (
    !/^\/admin(\/[\w./-]*)?$/.test(from) ||
    from.includes('..') ||
    from.includes('//') ||
    from.includes('\\')
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
