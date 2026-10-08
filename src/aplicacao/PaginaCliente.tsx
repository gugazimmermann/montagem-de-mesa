import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  aplicarIdentidadeLoja,
  limparIdentidadeLoja,
} from '../compartilhado/identidadeLoja'
import { aplicarMetaLoja, limparMetaLoja } from '../compartilhado/metaLoja'
import { rastrear } from '../compartilhado/observabilidade'
import type { CatalogoPublicoCarregado } from '../dados/repositorioClientes'
import { carregarCatalogoPublico } from '../dados/repositorioClientes'
import { registrarVisitaCatalogo } from '../dados/repositorioFunil'
import { useRenovarUrlsAssinadas } from '../dados/useRenovarUrlsAssinadas'
import App from './App'
import './App.css'

export function PaginaCliente() {
  const { slug } = useParams<{ slug: string }>()

  const query = useQuery({
    queryKey: ['catalogo-publico', slug ?? ''],
    queryFn: () => carregarCatalogoPublico(slug!),
    enabled: Boolean(slug),
    staleTime: 45_000,
  })

  const queryClient = useQueryClient()
  useRenovarUrlsAssinadas(query.data?.dados ?? null, (novos) => {
    if (!slug) return
    queryClient.setQueryData<CatalogoPublicoCarregado>(
      ['catalogo-publico', slug],
      (atual) => (atual?.dados ? { ...atual, dados: novos } : atual),
    )
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

  const temCatalogo = Boolean(query.data?.temAcesso && query.data.dados)
  const paywall = Boolean(query.data && !query.data.temAcesso && query.data.existe)

  useEffect(() => {
    if (temCatalogo) rastrear('catalog_loaded', { slug: slug ?? '' })
    if (paywall) rastrear('paywall_hit', { slug: slug ?? '', superficie: 'publica' })
  }, [temCatalogo, paywall, slug])

  useEffect(() => {
    if (!slug || !query.data?.temAcesso || !query.data.dados) return
    const dados = query.data.dados
    aplicarMetaLoja({
      nome: dados.nome,
      descricao: `Monte o lugar à mesa de ${dados.nome}.`,
      url: `${window.location.origin}/${slug}`,
      imagem: dados.logo || undefined,
    })
    return () => {
      limparMetaLoja()
    }
  }, [slug, query.data?.temAcesso, query.data?.dados])

  useEffect(() => {
    if (!slug || !query.data?.temAcesso) return
    const chave = `visita-catalogo:${slug}`
    try {
      if (sessionStorage.getItem(chave)) return
      sessionStorage.setItem(chave, '1')
    } catch {
      return
    }
    void registrarVisitaCatalogo(slug).catch(() => {
      // A contagem começa depois da migration; uma falha não bloqueia a página.
    })
  }, [slug, query.data?.temAcesso])

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
