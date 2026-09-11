import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { atualizarCategoria, excluirItemDb } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AmpliarImagem } from './AmpliarImagem'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import { AdminConfirmacao } from './AdminConfirmacao'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { useDadosCliente } from './useDadosCliente'
import { useFlashLocation } from './useFlashLocation'

export function EditarCategoria() {
  const { categoriaId } = useParams<{ categoriaId: string }>()
  const { cliente } = useAuth()
  const clienteId = cliente?.id

  const { dados, setDados, carregando, erro: erroCarga } = useDadosCliente(clienteId)
  const { flash } = useFlashLocation()

  const [rotulo, setRotulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [excluirItemId, setExcluirItemId] = useState<string | null>(null)

  useEffect(() => {
    if (flash) setMensagem(flash)
  }, [flash])

  useEffect(() => {
    if (erroCarga) setErro(erroCarga)
  }, [erroCarga])

  useEffect(() => {
    if (!dados || !categoriaId) return
    const cat = dados.categorias.find((c) => c.id === categoriaId)
    if (cat) {
      setRotulo(cat.rotulo)
      setDescricao(cat.descricao)
    }
  }, [dados, categoriaId])

  const itensCategoria = useMemo(
    () => (dados?.itens ?? []).filter((item) => item.categoria === categoriaId),
    [dados?.itens, categoriaId],
  )

  if (!cliente) return <AdminSessaoInvalida />
  if (carregando) return <AdminPainelCarregando />

  const idCliente = cliente.id
  const categoria = dados?.categorias.find((c) => c.id === categoriaId)

  if (!categoriaId || !categoria || !dados) {
    return <Navigate to="/admin/painel" replace />
  }

  const dadosAtuais = dados
  const idCategoria = categoriaId

  async function salvarCategoria(evento: FormEvent) {
    evento.preventDefault()
    setMensagem(null)
    setErro(null)
    const rotuloTrim = rotulo.trim()
    if (!rotuloTrim) {
      setErro('Informe o rótulo da categoria.')
      return
    }

    try {
      await atualizarCategoria(idCliente, {
        id: idCategoria,
        rotulo: rotuloTrim,
        descricao: descricao.trim(),
      })
      setDados({
        ...dadosAtuais,
        categorias: dadosAtuais.categorias.map((c) =>
          c.id === idCategoria
            ? { ...c, rotulo: rotuloTrim, descricao: descricao.trim() }
            : c,
        ),
      })
      setMensagem('Categoria salva.')
    } catch {
      setErro('Não foi possível salvar a categoria.')
    }
  }

  async function confirmarExcluirItem() {
    if (!excluirItemId) return
    const id = excluirItemId
    setExcluirItemId(null)
    setMensagem(null)
    setErro(null)
    try {
      await excluirItemDb(idCliente, id)
      setDados({
        ...dadosAtuais,
        itens: dadosAtuais.itens.filter((i) => i.id !== id),
      })
      setMensagem('Item excluído.')
    } catch {
      setErro('Não foi possível excluir o item.')
    }
  }

  return (
    <AdminPaginaPainel
      titulo={`${categoria.rotulo} (${itensCategoria.length} ${itensCategoria.length === 1 ? 'item' : 'itens'})`}
      breadcrumb={[
        { rotulo: 'Painel', para: '/admin/painel' },
        { rotulo: categoria.rotulo },
      ]}
      voltarPara="/admin/painel"
      voltarRotulo="Voltar ao painel"
      alerta={
        <>
          {erro && (
            <AdminAlerta tipo="error" titulo="Atenção">
              {erro}
            </AdminAlerta>
          )}
          {mensagem && !erro && (
            <AdminAlerta tipo="success" titulo="Pronto">
              {mensagem}
            </AdminAlerta>
          )}
        </>
      }
    >
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

        {itensCategoria.length === 0 ? (
          <AdminEstadoVazio
            titulo="Nenhum item nesta categoria"
            descricao="Adicione o primeiro item do catálogo."
            acao={
              <Link
                className="btn btn--primary"
                to={`/admin/painel/categorias/${categoriaId}/itens/novo`}
              >
                Criar primeiro item
              </Link>
            }
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
                <div className="admin-categorias__acoes">
                  <Link
                    className="btn btn--ghost"
                    to={`/admin/painel/categorias/${categoriaId}/itens/${item.id}`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    className="btn btn--danger"
                    onClick={() => setExcluirItemId(item.id)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminConfirmacao
        aberto={excluirItemId !== null}
        titulo="Excluir item?"
        descricao="Esta ação não pode ser desfeita."
        confirmarRotulo="Excluir"
        perigo
        aoCancelar={() => setExcluirItemId(null)}
        aoConfirmar={() => void confirmarExcluirItem()}
      />
    </AdminPaginaPainel>
  )
}
