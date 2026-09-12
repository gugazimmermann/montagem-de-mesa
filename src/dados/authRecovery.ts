/** Chave em user_metadata + localStorage para fluxo de recovery. */
export const META_PRECISA_REDEFINIR_SENHA = 'precisa_redefinir_senha'
export const CHAVE_RECOVERY_STORAGE = 'montagem:precisaRedefinirSenha'

export function metadataMarcaRecovery(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  return meta?.[META_PRECISA_REDEFINIR_SENHA] === true
}

export function lerFlagRecoveryLocal(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOVERY_STORAGE) === '1'
  } catch {
    return false
  }
}

export function gravarFlagRecoveryLocal(valor: boolean): void {
  try {
    if (valor) {
      localStorage.setItem(CHAVE_RECOVERY_STORAGE, '1')
      sessionStorage.removeItem(CHAVE_RECOVERY_STORAGE)
    } else {
      localStorage.removeItem(CHAVE_RECOVERY_STORAGE)
      sessionStorage.removeItem(CHAVE_RECOVERY_STORAGE)
    }
  } catch {
    // ignore
  }
}
