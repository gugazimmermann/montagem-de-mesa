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
