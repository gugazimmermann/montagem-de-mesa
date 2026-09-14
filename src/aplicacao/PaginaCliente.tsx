import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { DadosCliente } from '../compartilhado/tipos'
import {
  carregarDadosCliente,
  obterClientePorSlug,
  statusClientePublico,
} from '../dados/repositorioClientes'
import App from './App'
import './App.css'

export function PaginaCliente() {
  const { slug } = useParams<{ slug: string }>()
  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [whatsappAdmin, setWhatsappAdmin] = useState('')
  const [nomeSuspenso, setNomeSuspenso] = useState<string | null>(null)
  const [estado, setEstado] = useState<
    'carregando' | 'ok' | 'nao-encontrado' | 'suspenso' | 'erro'
  >('carregando')
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
        const status = await statusClientePublico(slug)
        if (!ativo) return

        if (!status.existe) {
          setDados(null)
          setClienteId(null)
          setWhatsappAdmin('')
          setNomeSuspenso(null)
          setEstado('nao-encontrado')
          return
        }

        if (!status.temAcesso) {
          setDados(null)
          setClienteId(null)
          setWhatsappAdmin('')
          setNomeSuspenso(status.nome)
          setEstado('suspenso')
          return
        }

        const cliente = await obterClientePorSlug(slug)
        if (!cliente) {
          if (ativo) {
            setDados(null)
            setClienteId(null)
            setWhatsappAdmin('')
            setNomeSuspenso(null)
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
        setWhatsappAdmin(cliente.whatsapp ?? '')
        setNomeSuspenso(null)
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

  if (estado === 'suspenso') {
    return (
      <div className="app app--mensagem">
        <h1>Conta temporariamente suspensa</h1>
        <p className="app__subtitle">
          {nomeSuspenso
            ? `A montagem de ${nomeSuspenso} está indisponível no momento.`
            : `A montagem em /${slug} está indisponível no momento.`}{' '}
          Ela volta a ficar pública quando a assinatura for reativada.
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

  if (estado === 'nao-encontrado' || !dados || !clienteId) {
    return (
      <div className="app app--mensagem">
        <h1>Montagem indisponível</h1>
        <p className="app__subtitle">
          Não há uma montagem pública em <code>/{slug}</code>. Verifique se o
          endereço está correto.
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

  return (
    <App
      key={clienteId}
      dados={dados}
      slug={slug!}
      whatsappAdmin={whatsappAdmin}
    />
  )
}
