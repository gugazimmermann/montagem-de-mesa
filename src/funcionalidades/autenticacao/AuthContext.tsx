import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
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

  const marcarPrecisaRedefinirSenha = useCallback((valor: boolean) => {
    gravarFlagRecoveryLocal(valor)
    setPrecisaRedefinirSenha(valor)
  }, [])

  useEffect(() => {
    let ativo = true

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
  }, [marcarPrecisaRedefinirSenha])

  const entrar = useCallback(
    async (email: string, senha: string): Promise<Cliente | null> => {
      const resultado = await entrarRepo(email, senha)
      marcarPrecisaRedefinirSenha(false)
      setCliente(resultado)
      return resultado
    },
    [marcarPrecisaRedefinirSenha],
  )

  const cadastrar = useCallback(
    async (dados: {
      nome: string
      email: string
      senha: string
    }): Promise<Cliente> => {
      const resultado = await cadastrarRepo(dados)
      marcarPrecisaRedefinirSenha(false)
      setCliente(resultado)
      return resultado
    },
    [marcarPrecisaRedefinirSenha],
  )

  const sair = useCallback(async (): Promise<void> => {
    await sairRepo()
    marcarPrecisaRedefinirSenha(false)
    setCliente(null)
  }, [marcarPrecisaRedefinirSenha])

  const definirCliente = useCallback((proximo: Cliente): void => {
    setCliente(proximo)
  }, [])

  const limparPrecisaRedefinirSenha = useCallback(async (): Promise<void> => {
    marcarPrecisaRedefinirSenha(false)
    try {
      const sessao = await obterSessaoCliente()
      setCliente(sessao)
    } catch {
      setCliente(null)
    }
  }, [marcarPrecisaRedefinirSenha])

  const value = useMemo(
    () => ({
      cliente,
      carregando,
      precisaRedefinirSenha,
      limparPrecisaRedefinirSenha,
      entrar,
      cadastrar,
      definirCliente,
      sair,
    }),
    [
      cliente,
      carregando,
      precisaRedefinirSenha,
      limparPrecisaRedefinirSenha,
      entrar,
      cadastrar,
      definirCliente,
      sair,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
