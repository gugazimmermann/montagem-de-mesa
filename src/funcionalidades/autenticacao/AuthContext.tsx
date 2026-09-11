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

/** localStorage: compartilhado entre abas (sessionStorage era bypassável). */
const CHAVE_RECOVERY = 'montagem:precisaRedefinirSenha'

function lerFlagRecovery(): boolean {
  try {
    return localStorage.getItem(CHAVE_RECOVERY) === '1'
  } catch {
    return false
  }
}

function gravarFlagRecovery(valor: boolean): void {
  try {
    if (valor) {
      localStorage.setItem(CHAVE_RECOVERY, '1')
      // Limpa flag legada por aba
      sessionStorage.removeItem(CHAVE_RECOVERY)
    } else {
      localStorage.removeItem(CHAVE_RECOVERY)
      sessionStorage.removeItem(CHAVE_RECOVERY)
    }
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [precisaRedefinirSenha, setPrecisaRedefinirSenha] = useState(lerFlagRecovery)

  function marcarPrecisaRedefinirSenha(valor: boolean) {
    gravarFlagRecovery(valor)
    setPrecisaRedefinirSenha(valor)
  }

  useEffect(() => {
    let ativo = true

    // Migra flag antiga de sessionStorage → localStorage
    try {
      if (sessionStorage.getItem(CHAVE_RECOVERY) === '1') {
        marcarPrecisaRedefinirSenha(true)
      }
    } catch {
      // ignore
    }

    // Em recovery: não carregar perfil admin até a senha ser redefinida.
    if (lerFlagRecovery()) {
      setCliente(null)
      setCarregando(false)
    } else {
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
    }

    const cancelar = ouvirSessao((proximo, meta) => {
      if (!ativo) return

      if (meta?.evento === 'PASSWORD_RECOVERY') {
        marcarPrecisaRedefinirSenha(true)
        setCliente(null)
        setCarregando(false)
        return
      }

      if (!meta?.sessaoValida) {
        setCliente(null)
        // Não limpar flag de recovery no sign-out transitório durante o link;
        // só limpa em sair()/entrar()/após redefinir.
        setCarregando(false)
        return
      }

      // Sessão válida, mas ainda em fluxo de recovery → sem dados admin.
      if (lerFlagRecovery()) {
        setCliente(null)
        setCarregando(false)
        return
      }

      if (proximo) {
        setCliente(proximo)
      }
      setCarregando(false)
    })

    const aoStorage = (evento: StorageEvent) => {
      if (evento.key === CHAVE_RECOVERY) {
        setPrecisaRedefinirSenha(evento.newValue === '1')
      }
    }
    window.addEventListener('storage', aoStorage)

    return () => {
      ativo = false
      cancelar()
      window.removeEventListener('storage', aoStorage)
    }
  }, [])

  async function entrar(email: string, senha: string): Promise<Cliente | null> {
    const resultado = await entrarRepo(email, senha)
    marcarPrecisaRedefinirSenha(false)
    setCliente(resultado)
    return resultado
  }

  async function cadastrar(dados: {
    nome: string
    email: string
    senha: string
  }): Promise<Cliente> {
    const resultado = await cadastrarRepo(dados)
    marcarPrecisaRedefinirSenha(false)
    setCliente(resultado)
    return resultado
  }

  async function sair(): Promise<void> {
    await sairRepo()
    marcarPrecisaRedefinirSenha(false)
    setCliente(null)
  }

  function definirCliente(proximo: Cliente): void {
    setCliente(proximo)
  }

  async function limparPrecisaRedefinirSenha(): Promise<void> {
    marcarPrecisaRedefinirSenha(false)
    try {
      const sessao = await obterSessaoCliente()
      setCliente(sessao)
    } catch {
      setCliente(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        cliente,
        carregando,
        precisaRedefinirSenha,
        limparPrecisaRedefinirSenha,
        entrar,
        cadastrar,
        definirCliente,
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
