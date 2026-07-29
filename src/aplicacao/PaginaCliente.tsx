import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { DadosCliente } from '../compartilhado/tipos'
import {
  carregarDadosCliente,
  obterClientePorSlug,
} from '../dados/repositorioClientes'
import App from './App'
import './App.css'

export function PaginaCliente() {
  const { slug } = useParams<{ slug: string }>()
  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'nao-encontrado' | 'erro'>(
    'carregando',
  )

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!slug) {
        if (ativo) setEstado('nao-encontrado')
        return
      }

      setEstado('carregando')
      try {
        const cliente = await obterClientePorSlug(slug)
        if (!cliente) {
          if (ativo) {
            setDados(null)
            setClienteId(null)
            setEstado('nao-encontrado')
          }
          return
        }

        const dadosCliente = await carregarDadosCliente(cliente.id)
        if (!ativo) return

        if (!dadosCliente) {
          setEstado('nao-encontrado')
          return
        }

        setClienteId(cliente.id)
        setDados(dadosCliente)
        setEstado('ok')
      } catch {
        if (ativo) setEstado('erro')
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [slug])

  if (estado === 'carregando') {
    return (
      <div className="app app--mensagem">
        <p className="app__subtitle">Carregando montagem…</p>
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div className="app app--mensagem">
        <h1>Erro ao carregar</h1>
        <p className="app__subtitle">Não foi possível carregar os dados do cliente.</p>
        <Link className="btn btn--primary" to="/c/raffiner">
          Tentar Raffiner
        </Link>
      </div>
    )
  }

  if (estado === 'nao-encontrado' || !dados || !clienteId) {
    return (
      <div className="app app--mensagem">
        <h1>Cliente não encontrado</h1>
        <p className="app__subtitle">
          Não existe um cliente com o endereço <code>/c/{slug}</code>.
        </p>
        <Link className="btn btn--primary" to="/c/raffiner">
          Ir para Raffiner
        </Link>
      </div>
    )
  }

  return <App key={clienteId} dados={dados} />
}
