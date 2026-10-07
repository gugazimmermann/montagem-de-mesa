import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  aplicarIdentidadeLoja,
  limparIdentidadeLoja,
} from '../compartilhado/identidadeLoja'
import { rastrear } from '../compartilhado/observabilidade'
import { carregarCatalogoPublico } from '../dados/repositorioClientes'
import { INTERVALO_REASSINAR_MS } from '../dados/storage'
import App from './App'
import './App.css'

export function PaginaCliente() {
  const { slug } = useParams<{ slug: string }>()

  const query = useQuery({
    queryKey: ['catalogo-publico', slug ?? ''],
    queryFn: () => carregarCatalogoPublico(slug!),
    enabled: Boolean(slug),
    staleTime: 45_000,
    refetchInterval: INTERVALO_REASSINAR_MS,
    refetchIntervalInBackground: false,
  })

  const corMarca = query.data?.corMarca ?? ''
  const corFundo = query.data?.corFundo ?? ''

  useEffect(() => {
    if (!query.data?.existe) {
      limparIdentidadeLoja()
      return
    }
    aplicarIdentidadeLoja(corMarca, corFundo)
    return () => {
      limparIdentidadeLoja()
    }
  }, [query.data?.existe, corMarca, corFundo])

  useEffect(() => {
    if (query.data?.temAcesso && query.data.dados) {
      rastrear('catalog_loaded', { slug: slug ?? '' })
    }
    if (query.data && !query.data.temAcesso && query.data.existe) {
      rastrear('paywall_hit', { slug: slug ?? '', superficie: 'publica' })
    }
  }, [query.data, slug])

  if (!slug) {
    return (
      <div className="app-shell app-shell--status">
        <p>Montagem não encontrada.</p>
        <Link to="/">Início</Link>
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div className="app-shell app-shell--status">
        <p>Carregando montagem…</p>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="app-shell app-shell--status">
        <p>Não foi possível carregar esta montagem.</p>
        <button type="button" onClick={() => void query.refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  const resultado = query.data
  if (!resultado?.existe) {
    return (
      <div className="app-shell app-shell--status">
        <p>Montagem não encontrada.</p>
        <Link to="/">Início</Link>
      </div>
    )
  }

  if (!resultado.temAcesso) {
    const wa = resultado.whatsapp.replace(/\D/g, '')
    return (
      <div className="app-shell app-shell--status">
        <p>
          A montagem de {resultado.nome ?? 'este estabelecimento'} está temporariamente
          indisponível.
        </p>
        <p>Fale com o estabelecimento para mais informações.</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {wa.length >= 12 ? (
            <a
              className="btn btn--primary"
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          ) : null}
          <Link className="btn btn--ghost" to="/">
            Início
          </Link>
        </div>
      </div>
    )
  }

  if (!resultado.dados) {
    return (
      <div className="app-shell app-shell--status">
        <p>Montagem não encontrada.</p>
        <Link to="/">Início</Link>
      </div>
    )
  }

  return (
    <App
      dados={resultado.dados}
      slug={slug}
      whatsappAdmin={resultado.whatsapp}
    />
  )
}
