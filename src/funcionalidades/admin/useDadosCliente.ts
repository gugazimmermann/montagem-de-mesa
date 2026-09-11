import { useEffect, useState } from 'react'
import type { DadosCliente } from '../../compartilhado/tipos'
import { carregarDadosCliente } from '../../dados/repositorioClientes'

export function useDadosCliente(clienteId: string | undefined) {
  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [carregando, setCarregando] = useState(Boolean(clienteId))
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!clienteId) {
      setDados(null)
      setCarregando(false)
      return
    }

    let ativo = true
    setCarregando(true)
    setErro(null)

    void carregarDadosCliente(clienteId)
      .then((d) => {
        if (!ativo) return
        setDados(d)
        if (!d) setErro('Conta não encontrada.')
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar os dados.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    return () => {
      ativo = false
    }
  }, [clienteId])

  return { dados, setDados, carregando, erro, setErro }
}
