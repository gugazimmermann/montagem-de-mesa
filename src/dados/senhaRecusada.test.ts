import { describe, expect, it } from 'vitest'
import { mensagemSenhaRecusada } from './repositorioAuth'

describe('mensagemSenhaRecusada', () => {
  it('explica senha encontrada em vazamento', () => {
    expect(
      mensagemSenhaRecusada({
        code: 'weak_password',
        message: 'Password is known to be weak and easy to guess, please choose a different one.',
        reasons: ['pwned'],
      }),
    ).toMatch(/vazamentos/)
  })

  it('trata senha fraca sem vazamento de outro jeito', () => {
    expect(mensagemSenhaRecusada({ code: 'weak_password', reasons: ['length'] })).toBe(
      'Escolha uma senha mais forte.',
    )
  })

  it('ignora outros erros de auth', () => {
    expect(mensagemSenhaRecusada({ code: 'user_already_exists' })).toBeNull()
  })
})
