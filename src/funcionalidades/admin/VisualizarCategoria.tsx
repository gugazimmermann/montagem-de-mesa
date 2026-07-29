import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { DadosCliente } from '../../compartilhado/tipos'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import { carregarDadosCliente } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import './PainelAdmin.css'
import './LoginAdmin.css'
import './EditarCategoria.css'

export function VisualizarCategoria() {
  const { categoriaId } = useParams<{ categoriaId: string }>()
  const { cliente } = useAuth()
  const clienteId = cliente!.id

  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    void carregarDadosCliente(clienteId)
      .then((d) => {
        if (ativo && d) setDados(d)
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [clienteId])

  const categoria = dados?.categorias.find((c) => c.id === categoriaId)

  const itensCategoria = useMemo(
    () => (dados?.itens ?? []).filter((item) => item.categoria === categoriaId),
    [dados?.itens, categoriaId],
  )

  if (carregando) {
    return (
      <div className="admin-painel">
        <p className="admin-painel__alerta">Carregando…</p>
      </div>
    )
  }

  if (!categoriaId || !categoria) {
    return <Navigate to="/admin/painel" replace />
  }

  if (!ehCategoriaFixa(categoriaId)) {
    return <Navigate to={`/admin/painel/categorias/${categoriaId}`} replace />
  }

  return (
    <div className="admin-painel">
      <header className="admin-painel__header">
        <div>
          <p className="admin-painel__eyebrow">Visualizar categoria</p>
          <h1>
            {categoria.rotulo}{' '}
            <span className="admin-categorias__badge">Fixa</span>
            <span className="admin-categorias__qtd">
              ({itensCategoria.length} {itensCategoria.length === 1 ? 'item' : 'itens'})
            </span>
          </h1>
        </div>
        <div className="admin-painel__acoes">
          <Link className="btn btn--ghost" to="/admin/painel">
            Voltar ao painel
          </Link>
        </div>
      </header>

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

        <ul className="admin-itens">
          {itensCategoria.map((item) => (
            <li key={item.id} className="admin-itens__item">
              <div className="admin-itens__preview" aria-hidden="true">
                {item.imagem ? (
                  <img src={item.imagem} alt="" />
                ) : (
                  <span style={{ background: item.cores.primaria }} />
                )}
              </div>
              <div className="admin-itens__info">
                <strong>{item.nome}</strong>
                {item.descricao && <p>{item.descricao}</p>}
                {item.padrao && (
                  <span className="admin-categorias__id">Padrão: {item.padrao}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
