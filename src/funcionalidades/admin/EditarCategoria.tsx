import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import type { DadosCliente } from '../../compartilhado/tipos'
import {
  atualizarCategoria,
  carregarDadosCliente,
  excluirItemDb,
} from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import './PainelAdmin.css'
import './LoginAdmin.css'
import './EditarCategoria.css'

export function EditarCategoria() {
  const { categoriaId } = useParams<{ categoriaId: string }>()
  const { cliente } = useAuth()
  const clienteId = cliente!.id

  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [rotulo, setRotulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    void carregarDadosCliente(clienteId)
      .then((d) => {
        if (!ativo || !d) return
        setDados(d)
        const cat = d.categorias.find((c) => c.id === categoriaId)
        if (cat) {
          setRotulo(cat.rotulo)
          setDescricao(cat.descricao)
        }
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar a categoria.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [clienteId, categoriaId])

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

  if (!categoriaId || !categoria || !dados) {
    return <Navigate to="/admin/painel" replace />
  }

  async function salvarCategoria(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    const rotuloTrim = rotulo.trim()
    if (!rotuloTrim) {
      setErro('Informe o rótulo da categoria.')
      return
    }

    try {
      await atualizarCategoria(clienteId, {
        id: categoriaId!,
        rotulo: rotuloTrim,
        descricao: descricao.trim(),
      })
      setDados({
        ...dados!,
        categorias: dados!.categorias.map((c) =>
          c.id === categoriaId
            ? { ...c, rotulo: rotuloTrim, descricao: descricao.trim() }
            : c,
        ),
      })
      setMensagem('Categoria salva.')
    } catch {
      setErro('Não foi possível salvar a categoria.')
    }
  }

  async function excluirItem(id: string) {
    const ok = window.confirm('Excluir este item?')
    if (!ok) return

    try {
      await excluirItemDb(clienteId, id)
      setDados({
        ...dados!,
        itens: dados!.itens.filter((i) => i.id !== id),
      })
      setMensagem('Item excluído.')
    } catch {
      setErro('Não foi possível excluir o item.')
    }
  }

  return (
    <div className="admin-painel">
      <header className="admin-painel__header">
        <div>
          <p className="admin-painel__eyebrow">Editar categoria</p>
          <h1>
            {categoria.rotulo}{' '}
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

      {(mensagem || erro) && (
        <p
          className={
            erro ? 'admin-painel__alerta admin-painel__alerta--erro' : 'admin-painel__alerta'
          }
          role="status"
        >
          {erro ?? mensagem}
        </p>
      )}

      <section className="admin-painel__secao">
        <h2>Dados da categoria</h2>
        <form className="admin-painel__form" onSubmit={(e) => void salvarCategoria(e)}>
          <label className="admin-field">
            <span>Rótulo</span>
            <input
              type="text"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              required
            />
          </label>

          <label className="admin-field">
            <span>Descrição</span>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </label>

          <button type="submit" className="btn btn--primary">
            Salvar categoria
          </button>
        </form>
      </section>

      <section className="admin-painel__secao">
        <div className="admin-itens__cabecalho">
          <h2>Itens</h2>
          <Link
            className="btn btn--primary"
            to={`/admin/painel/categorias/${categoriaId}/itens/novo`}
          >
            Novo item
          </Link>
        </div>

        <ul className="admin-itens">
          {itensCategoria.length === 0 && (
            <li className="admin-categorias__vazio">Nenhum item nesta categoria.</li>
          )}
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
                <span className="admin-categorias__id">{item.id}</span>
                {item.descricao && <p>{item.descricao}</p>}
              </div>
              <div className="admin-categorias__acoes">
                <Link
                  className="btn btn--ghost"
                  to={`/admin/painel/categorias/${categoriaId}/itens/${item.id}`}
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => void excluirItem(item.id)}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
