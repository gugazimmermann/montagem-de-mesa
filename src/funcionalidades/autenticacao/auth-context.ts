import { createContext } from 'react'
import type { Cliente } from '../../compartilhado/tipos'

export interface AuthContextValor {
  cliente: Cliente | null
  carregando: boolean
  /** Sessão veio de link de recovery; bloquear admin até trocar a senha. */
  precisaRedefinirSenha: boolean
  limparPrecisaRedefinirSenha: () => void | Promise<void>
  entrar: (email: string, senha: string) => Promise<Cliente | null>
  cadastrar: (dados: {
    nome: string
    email: string
    senha: string
  }) => Promise<Cliente>
  definirCliente: (cliente: Cliente) => void
  sair: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValor | null>(null)
