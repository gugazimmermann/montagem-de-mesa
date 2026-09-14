import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { atualizarCategoria, excluirItemDb, trocarOrdemItem } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AmpliarImagem } from './AmpliarImagem'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import { AdminConfirmacao } from './AdminConfirmacao'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import * as ui from './adminClasses'
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
  const [erroRotulo, setErroRotulo] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [excluirItemId, setExcluirItemId] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [reordenando, setReordenando] = useState(false)

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
    setErroRotulo(null)
    const rotuloTrim = rotulo.trim()
    if (!rotuloTrim) {
      setErroRotulo('Informe o rótulo da categoria.')
      return
    }

    setSalvando(true)
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
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarExcluirItem() {
    if (!excluirItemId || excluindo) return
    const id = excluirItemId
    setExcluindo(true)
    setMensagem(null)
    setErro(null)
    try {
      await excluirItemDb(idCliente, id)
      setDados({
        ...dadosAtuais,
        itens: dadosAtuais.itens.filter((i) => i.id !== id),
      })
      setExcluirItemId(null)
      setMensagem('Item excluído.')
    } catch {
      setErro('Não foi possível excluir o item.')
    } finally {
      setExcluindo(false)
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
        erro || mensagem ? (
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
        ) : null
      }
    >
      <section className={ui.painelSecao}>
        <h2>Dados da categoria</h2>
        <form className={ui.painelForm} onSubmit={(e) => void salvarCategoria(e)}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Rótulo</span>
            <input
              className={ui.fieldInput}
              type="text"
              value={rotulo}
              onChange={(e) => {
                setRotulo(e.target.value)
                setErroRotulo(null)
              }}
              required
              disabled={salvando}
              aria-invalid={erroRotulo ? true : undefined}
              aria-describedby={erroRotulo ? 'erro-rotulo-categoria' : undefined}
            />
            {erroRotulo && (
              <span id="erro-rotulo-categoria" className={ui.fieldErro} role="alert">
                {erroRotulo}
              </span>
            )}
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Descrição</span>
            <textarea
              className={ui.fieldInput}
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={salvando}
            />
          </label>

          <button type="submit" className="btn btn--primary" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar categoria'}
          </button>
        </form>
      </section>

      <section className={ui.painelSecao}>
        <div className={ui.itensCabecalho}>
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
          <ul className={ui.list}>
            {itensCategoria.map((item, indice) => {
              const anterior = itensCategoria[indice - 1]
              const proximo = itensCategoria[indice + 1]
              return (
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
                <div className={ui.listAcoes}>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={!anterior || reordenando}
                    aria-label="Mover item para cima"
                    onClick={() => {
                      if (!anterior) return
                      setReordenando(true)
                      void (async () => {
                        try {
                          await trocarOrdemItem(
                            idCliente,
                            idCategoria,
                            item.id,
                            anterior.id,
                          )
                          const ids = itensCategoria.map((i) => i.id)
                          const i = ids.indexOf(item.id)
                          const j = ids.indexOf(anterior.id)
                          const reordenados = [...dadosAtuais.itens]
                          const posI = reordenados.findIndex((x) => x.id === item.id)
                          const posJ = reordenados.findIndex((x) => x.id === anterior.id)
                          if (posI >= 0 && posJ >= 0) {
                            ;[reordenados[posI], reordenados[posJ]] = [
                              reordenados[posJ]!,
                              reordenados[posI]!,
                            ]
                            setDados({ ...dadosAtuais, itens: reordenados })
                          }
                          void i
                          void j
                        } catch {
                          setErro('Não foi possível reordenar.')
                        } finally {
                          setReordenando(false)
                        }
                      })()
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost"
                    disabled={!proximo || reordenando}
                    aria-label="Mover item para baixo"
                    onClick={() => {
                      if (!proximo) return
                      setReordenando(true)
                      void (async () => {
                        try {
                          await trocarOrdemItem(
                            idCliente,
                            idCategoria,
                            item.id,
                            proximo.id,
                          )
                          const reordenados = [...dadosAtuais.itens]
                          const posI = reordenados.findIndex((x) => x.id === item.id)
                          const posJ = reordenados.findIndex((x) => x.id === proximo.id)
                          if (posI >= 0 && posJ >= 0) {
                            ;[reordenados[posI], reordenados[posJ]] = [
                              reordenados[posJ]!,
                              reordenados[posI]!,
                            ]
                            setDados({ ...dadosAtuais, itens: reordenados })
                          }
                        } catch {
                          setErro('Não foi possível reordenar.')
                        } finally {
                          setReordenando(false)
                        }
                      })()
                    }}
                  >
                    ↓
                  </button>
                  <Link
                    className="btn btn--ghost"
                    to={`/admin/painel/categorias/${categoriaId}/itens/${item.id}`}
                  >
                    Editar
                  </Link>
                  <button
                    type="button"
                    className="btn btn--danger-soft"
                    onClick={() => setExcluirItemId(item.id)}
                  >
                    Excluir
                  </button>
                </div>
              </li>
              )
            })}
          </ul>
        )}
      </section>

      <AdminConfirmacao
        aberto={excluirItemId !== null}
        titulo="Excluir item?"
        descricao="O item sai do catálogo público. Confirme para continuar."
        confirmarRotulo="Excluir"
        processando={excluindo}
        processandoRotulo="Excluindo…"
        perigo
        aoCancelar={() => {
          if (!excluindo) setExcluirItemId(null)
        }}
        aoConfirmar={() => void confirmarExcluirItem()}
      />
    </AdminPaginaPainel>
  )
}
