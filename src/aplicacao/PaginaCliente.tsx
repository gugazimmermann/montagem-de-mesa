import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { carregarCatalogoPublico } from '../dados/repositorioClientes'
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

  if (!slug) {
    return (
      <div className="app-shell app-shell--status">
        <p>Montagem não encontrada.</p>
        <Link to="/admin">Área do estabelecimento</Link>
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
        <Link to="/admin">Área do estabelecimento</Link>
      </div>
    )
  }

  if (!resultado.temAcesso) {
    return (
      <div className="app-shell app-shell--status">
        <p>
          A montagem de {resultado.nome ?? 'este estabelecimento'} está temporariamente
          indisponível.
        </p>
        <Link to="/admin">Área do estabelecimento</Link>
      </div>
    )
  }

  if (!resultado.dados) {
    return (
      <div className="app-shell app-shell--status">
        <p>Montagem não encontrada.</p>
        <Link to="/admin">Área do estabelecimento</Link>
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
