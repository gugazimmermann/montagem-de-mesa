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
import * as ui from './adminClasses'
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
          <span className={`${ui.painelEyebrow} block`}>
            Visualizar categoria
          </span>
          {categoria.rotulo}{' '}
          <span className={ui.categoriasBadge}>Fixa</span>
          <span className={ui.categoriasQtd}>
            ({itensCategoria.length} {itensCategoria.length === 1 ? 'item' : 'itens'})
          </span>
        </>
      }
      voltarPara="/admin/painel"
      voltarRotulo="Voltar ao painel"
    >
      <section className={ui.painelSecao}>
        <h2>Sobre</h2>
        <p className="text-muted text-[0.95rem] m-0">
          {categoria.descricao || 'Catálogo compartilhado entre todos os clientes.'}
        </p>
        <p className="mt-3 text-[0.85rem] text-muted italic m-0">
          Esta categoria é fixa e não pode ser editada pelo painel.
        </p>
      </section>

      <section className={ui.painelSecao}>
        <h2>Itens ({itensCategoria.length})</h2>

        {itensCategoria.length === 0 ? (
          <AdminEstadoVazio
            titulo="Nenhum item"
            descricao="Esta categoria fixa ainda não tem itens listados."
          />
        ) : (
          <ul className={ui.list}>
            {itensCategoria.map((item) => (
              <li key={item.id} className={ui.itensItem}>
                {item.imagem ? (
                  <AmpliarImagem src={item.imagem} alt={item.nome} />
                ) : (
                  <div className={ui.itensPreview} aria-hidden="true">
                    <span style={{ background: item.cores.primaria }} />
                  </div>
                )}
                <div className={ui.itensInfo}>
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
