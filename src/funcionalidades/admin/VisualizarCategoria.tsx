import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import { useAuth } from '../autenticacao'
import { AmpliarImagem } from './AmpliarImagem'
import { AdminEstadoVazio } from './AdminFeedback'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { useDadosCliente } from './useDadosCliente'

export function VisualizarCategoria() {
  const { categoriaId } = useParams<{ categoriaId: string }>()
  const { cliente } = useAuth()
  const clienteId = cliente?.id

  const { dados, carregando } = useDadosCliente(clienteId)

  const itensCategoria = useMemo(
    () => (dados?.itens ?? []).filter((item) => item.categoria === categoriaId),
    [dados?.itens, categoriaId],
  )

  if (!clienteId) return <AdminSessaoInvalida />
  if (carregando) return <AdminPainelCarregando />

  const categoria = dados?.categorias.find((c) => c.id === categoriaId)

  if (!categoriaId || !categoria) {
    return <Navigate to="/admin/painel" replace />
  }

  if (!ehCategoriaFixa(categoriaId)) {
    return <Navigate to={`/admin/painel/categorias/${categoriaId}`} replace />
  }

  return (
    <AdminPaginaPainel
      titulo={
        <>
          <span className="admin-painel__eyebrow" style={{ display: 'block' }}>
            Visualizar categoria
          </span>
          {categoria.rotulo}{' '}
          <span className="admin-categorias__badge">Fixa</span>
          <span className="admin-categorias__qtd">
            ({itensCategoria.length} {itensCategoria.length === 1 ? 'item' : 'itens'})
          </span>
        </>
      }
      voltarPara="/admin/painel"
      voltarRotulo="Voltar ao painel"
    >
      <section className="admin-painel__secao">
        <h2>Sobre</h2>
        <p className="admin-categorias__descricao-fixa">
          {categoria.descricao || 'Catálogo compartilhado entre todos os clientes.'}
        </p>
        <p className="admin-categorias__aviso-fixa">
          Esta categoria é fixa e não pode ser editada pelo painel.
        </p>
      </section>

      <section className="admin-painel__secao">
        <h2>Itens ({itensCategoria.length})</h2>

        {itensCategoria.length === 0 ? (
          <AdminEstadoVazio
            titulo="Nenhum item"
            descricao="Esta categoria fixa ainda não tem itens listados."
          />
        ) : (
          <ul className="admin-itens">
            {itensCategoria.map((item) => (
              <li key={item.id} className="admin-itens__item">
                {item.imagem ? (
                  <AmpliarImagem src={item.imagem} alt={item.nome} />
                ) : (
                  <div className="admin-itens__preview" aria-hidden="true">
                    <span style={{ background: item.cores.primaria }} />
                  </div>
                )}
                <div className="admin-itens__info">
                  <strong>{item.nome}</strong>
                  {item.descricao && <p>{item.descricao}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPaginaPainel>
  )
}
