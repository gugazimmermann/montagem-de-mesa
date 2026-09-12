import { useEffect, useState, type ReactNode } from 'react'
import type { Cliente } from '../../compartilhado/tipos'
import {
  cadastrar as cadastrarRepo,
  entrar as entrarRepo,
  obterSessaoCliente,
  ouvirSessao,
  sair as sairRepo,
  sessaoExigeRedefinirSenha,
} from '../../dados/repositorioClientes'
import { AuthContext } from './auth-context'
import {
  CHAVE_RECOVERY_STORAGE,
  gravarFlagRecoveryLocal,
  lerFlagRecoveryLocal,
} from '../../dados/authRecovery'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [precisaRedefinirSenha, setPrecisaRedefinirSenha] = useState(lerFlagRecoveryLocal)

  function marcarPrecisaRedefinirSenha(valor: boolean) {
    gravarFlagRecoveryLocal(valor)
    setPrecisaRedefinirSenha(valor)
  }

  useEffect(() => {
    let ativo = true

    // Migra flag antiga de sessionStorage → localStorage
    try {
      if (sessionStorage.getItem(CHAVE_RECOVERY_STORAGE) === '1') {
        marcarPrecisaRedefinirSenha(true)
      }
    } catch {
      // ignore
    }

    void (async () => {
      try {
        const exigeMeta = await sessaoExigeRedefinirSenha()
        if (!ativo) return

        if (lerFlagRecoveryLocal() || exigeMeta) {
          marcarPrecisaRedefinirSenha(true)
          setCliente(null)
          setCarregando(false)
          return
        }

        const sessao = await obterSessaoCliente()
        if (!ativo) return
        setCliente(sessao)
      } catch {
        if (ativo) setCliente(null)
      } finally {
        if (ativo) setCarregando(false)
      }
    })()

    const cancelar = ouvirSessao((proximo, meta) => {
      if (!ativo) return

      if (meta?.evento === 'PASSWORD_RECOVERY') {
        marcarPrecisaRedefinirSenha(true)
        setCliente(null)
        setCarregando(false)
        return
      }

      if (meta?.precisaRedefinirSenha) {
        marcarPrecisaRedefinirSenha(true)
        setCliente(null)
        setCarregando(false)
        return
      }

      if (!meta?.sessaoValida) {
        setCliente(null)
        setCarregando(false)
        return
      }

      // Sessão válida, mas ainda em fluxo de recovery (flag local) → sem dados admin.
      if (lerFlagRecoveryLocal()) {
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
      if (evento.key === CHAVE_RECOVERY_STORAGE) {
        const ativoFlag = evento.newValue === '1'
        setPrecisaRedefinirSenha(ativoFlag)
        if (ativoFlag) setCliente(null)
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
