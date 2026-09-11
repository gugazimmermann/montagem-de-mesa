import { useEffect, useState, type ReactNode } from 'react'
import type { Cliente } from '../../compartilhado/tipos'
import {
  cadastrar as cadastrarRepo,
  entrar as entrarRepo,
  obterSessaoCliente,
  ouvirSessao,
  sair as sairRepo,
} from '../../dados/repositorioClientes'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true

    void obterSessaoCliente()
      .then((sessao) => {
        if (ativo) setCliente(sessao)
      })
      .catch(() => {
        if (ativo) setCliente(null)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    const cancelar = ouvirSessao((proximo) => {
      if (ativo) {
        setCliente(proximo)
        setCarregando(false)
      }
    })

    return () => {
      ativo = false
      cancelar()
    }
  }, [])

  async function entrar(email: string, senha: string): Promise<Cliente | null> {
    const resultado = await entrarRepo(email, senha)
    setCliente(resultado)
    return resultado
  }

  async function cadastrar(dados: {
    nome: string
    email: string
    senha: string
  }): Promise<Cliente> {
    const resultado = await cadastrarRepo(dados)
    setCliente(resultado)
    return resultado
  }

  async function sair(): Promise<void> {
    await sairRepo()
    setCliente(null)
  }

  return (
    <AuthContext.Provider value={{ cliente, carregando, entrar, cadastrar, sair }}>
      {children}
    </AuthContext.Provider>
  )
}
