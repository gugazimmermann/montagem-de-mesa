import { createContext } from 'react'
import type { Cliente } from '../../compartilhado/tipos'

export interface AuthContextValor {
  cliente: Cliente | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<Cliente | null>
  sair: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValor | null>(null)
