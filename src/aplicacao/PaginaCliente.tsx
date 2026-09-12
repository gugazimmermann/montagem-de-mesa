import { useCallback, useEffect, useState } from 'react'
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
  const [tentativa, setTentativa] = useState(0)

  const tentarNovamente = useCallback(() => {
    setTentativa((n) => n + 1)
  }, [])

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
  }, [slug, tentativa])

  if (estado === 'carregando') {
    return (
      <div className="app app--mensagem">
        <div className="app__loading" role="status" aria-live="polite" aria-busy="true">
          <span className="app__loading-spinner" aria-hidden="true" />
          <p>Carregando montagem…</p>
        </div>
      </div>
    )
  }

  if (estado === 'erro') {
    return (
      <div className="app app--mensagem">
        <h1>Erro ao carregar</h1>
        <p className="app__subtitle">Não foi possível carregar os dados deste endereço.</p>
        <button type="button" className="btn btn--primary" onClick={tentarNovamente}>
          Tentar novamente
        </button>
        <Link className="btn btn--ghost" to="/admin">
          Ir para o admin
        </Link>
      </div>
    )
  }

  if (estado === 'nao-encontrado' || !dados || !clienteId) {
    return (
      <div className="app app--mensagem">
        <h1>Montagem indisponível</h1>
        <p className="app__subtitle">
          Não há uma montagem pública ativa em <code>/{slug}</code>. O endereço
          pode não existir ou a assinatura do estabelecimento não está ativa.
        </p>
        <button type="button" className="btn btn--primary" onClick={tentarNovamente}>
          Tentar novamente
        </button>
        <Link className="btn btn--ghost" to="/admin">
          Entrar no admin
        </Link>
      </div>
    )
  }

  return <App key={clienteId} dados={dados} />
}
