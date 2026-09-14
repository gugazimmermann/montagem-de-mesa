import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import { excluirCategoriaDb } from '../../dados/repositorioClientes'
import { contarMontagensNovas } from '../../dados/repositorioMontagens'
import { trocarOrdemCategoria } from '../../dados/repositorioCatalogo'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import { AdminBannerTrial } from './AdminBannerTrial'
import { AdminAjuda } from './AdminAjuda'
import { AdminConfirmacao, AdminMenuMais } from './AdminConfirmacao'
import { AdminOnboarding } from './AdminOnboarding'
import {
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { montagensQueryKey, useDadosCliente } from './useDadosCliente'
import { useFlashLocation } from './useFlashLocation'
import * as ui from './adminClasses'

type Feedback = { tipo: 'success' | 'error'; texto: string }

export function PainelAdmin() {
  const navegar = useNavigate()
  const { cliente, sair } = useAuth()
  const clienteId = cliente?.id

  const { dados, setDados, carregando, erro: erroCarga } = useDadosCliente(clienteId)
  const { flash } = useFlashLocation()

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [excluirId, setExcluirId] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [reordenando, setReordenando] = useState(false)

  const queryNovos = useQuery({
    queryKey: clienteId
      ? [...montagensQueryKey(clienteId), 'count-novos']
      : ['montagens', 'none', 'count'],
    queryFn: () => contarMontagensNovas(clienteId!),
    enabled: Boolean(clienteId),
    staleTime: 30_000,
  })
  const qtdNovos = queryNovos.data ?? 0

  useEffect(() => {
    if (flash) setFeedback({ tipo: 'success', texto: flash })
  }, [flash])

  useEffect(() => {
    if (erroCarga) setFeedback({ tipo: 'error', texto: erroCarga })
  }, [erroCarga])

  useEffect(() => {
    if (!feedback || feedback.tipo !== 'success') return
    const t = window.setTimeout(() => setFeedback(null), 4000)
    return () => window.clearTimeout(t)
  }, [feedback])

  const linkPublico = useMemo(
    () => (cliente ? `/${cliente.slug}` : '/'),
    [cliente],
  )

  async function confirmarExclusao() {
    if (!dados || !clienteId || !excluirId || excluindo) return
    const id = excluirId
    setExcluindo(true)
    try {
      await excluirCategoriaDb(clienteId, id)
      setDados({
        ...dados,
        categorias: dados.categorias.filter((c) => c.id !== id),
        itens: dados.itens.filter((item) => item.categoria !== id),
      })
      setExcluirId(null)
      setFeedback({ tipo: 'success', texto: 'Categoria excluída.' })
    } catch {
      setFeedback({ tipo: 'error', texto: 'Não foi possível excluir a categoria.' })
    } finally {
      setExcluindo(false)
    }
  }

  async function aoSair() {
    await sair()
    navegar('/admin', { replace: true })
  }

  if (!clienteId) return <AdminSessaoInvalida />
  if (carregando) return <AdminPainelCarregando mensagem="Carregando painel…" />

  if (feedback?.tipo === 'error' && !dados) {
    return (
      <div className={ui.painel}>
        <AdminAlerta tipo="error" titulo="Erro">
          {feedback.texto}
        </AdminAlerta>
        <button type="button" className="btn btn--ghost" onClick={() => void aoSair()}>
          Sair
        </button>
      </div>
    )
  }

  if (!dados) {
    return (
      <div className={ui.painel}>
        <AdminAlerta tipo="error" titulo="Conta não encontrada">
          Faça login novamente ou conclua o cadastro.
        </AdminAlerta>
        <button type="button" className="btn btn--ghost" onClick={() => void aoSair()}>
          Sair
        </button>
      </div>
    )
  }

  const nomeExibido = cliente?.nome ?? dados.nome

  return (
    <div className={ui.painel}>
      <AdminBannerTrial />
      <AdminOnboarding
        cliente={cliente}
        dados={dados}
        linkPublico={linkPublico}
        aoAbrirAjuda={() => setAjudaAberta(true)}
      />
      <header className={ui.painelHeader}>
        <div>
          <p className={ui.painelEyebrow}>Painel do cliente</p>
          <h1 className={ui.painelTitulo}>{nomeExibido}</h1>
        </div>
        <div className={ui.painelAcoes}>
          <div className={ui.acoesDesktop}>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setAjudaAberta(true)}
            >
              Ajuda
            </button>
            <Link className="btn btn--ghost" to={linkPublico}>
              Ver montagem
            </Link>
            <Link className="btn btn--ghost" to="/admin/painel/montagens">
              Montagens enviadas
              {qtdNovos > 0 ? ` (${qtdNovos})` : ''}
            </Link>
            <Link className="btn btn--ghost" to="/admin/painel/cadastro">
              Atualizar cadastro
            </Link>
            <Link className="btn btn--ghost" to="/admin/assinatura">
              Assinatura
            </Link>
            <button type="button" className="btn btn--ghost" onClick={() => void aoSair()}>
              Sair
            </button>
          </div>
          <div className={ui.acoesMobile}>
            <AdminMenuMais
              aberto={menuAberto}
              aoAlternar={() => setMenuAberto((v) => !v)}
              aoFechar={() => setMenuAberto(false)}
            >
              <button
                type="button"
                className="btn btn--ghost"
                role="menuitem"
                onClick={() => {
                  setMenuAberto(false)
                  setAjudaAberta(true)
                }}
              >
                Ajuda
              </button>
              <Link
                className="btn btn--ghost"
                role="menuitem"
                to={linkPublico}
                onClick={() => setMenuAberto(false)}
              >
                Ver montagem
              </Link>
              <Link
                className="btn btn--ghost"
                role="menuitem"
                to="/admin/painel/montagens"
                onClick={() => setMenuAberto(false)}
              >
                Montagens enviadas
                {qtdNovos > 0 ? ` (${qtdNovos})` : ''}
              </Link>
              <Link
                className="btn btn--ghost"
                role="menuitem"
                to="/admin/painel/cadastro"
                onClick={() => setMenuAberto(false)}
              >
                Atualizar cadastro
              </Link>
              <Link
                className="btn btn--ghost"
                role="menuitem"
                to="/admin/assinatura"
                onClick={() => setMenuAberto(false)}
              >
                Assinatura
              </Link>
              <button
                type="button"
                className="btn btn--ghost"
                role="menuitem"
                onClick={() => void aoSair()}
              >
                Sair
              </button>
            </AdminMenuMais>
          </div>
        </div>
      </header>

      {feedback && (
        <AdminAlerta
          tipo={feedback.tipo === 'error' ? 'error' : 'success'}
          titulo={feedback.tipo === 'error' ? 'Atenção' : 'Pronto'}
        >
          {feedback.texto}
        </AdminAlerta>
      )}

      <section className={ui.painelSecao}>
        <div className={ui.itensCabecalho}>
          <h2>Categorias ({dados.categorias.length})</h2>
          <Link className="btn btn--primary" to="/admin/painel/categorias/novo">
            Nova categoria
          </Link>
        </div>

        {dados.categorias.length === 0 ? (
          <AdminEstadoVazio
            titulo="Nenhuma categoria ainda"
            descricao="Crie a primeira categoria para começar a montar o catálogo."
            acao={
              <Link className="btn btn--primary" to="/admin/painel/categorias/novo">
                Criar primeira categoria
              </Link>
            }
          />
        ) : (
          <ul className={ui.list}>
            {dados.categorias.map((categoria, indice) => {
              const qtdItens = dados.itens.filter((i) => i.categoria === categoria.id).length
              const fixa = ehCategoriaFixa(categoria.id)
              const anterior = dados.categorias[indice - 1]
              const proxima = dados.categorias[indice + 1]
              return (
                <li key={categoria.id} className={ui.listItem}>
                  <div>
                    <strong className="block">
                      {categoria.rotulo}{' '}
                      {fixa && <span className={ui.categoriasBadge}>Fixa</span>}
                      <span className={ui.categoriasQtd}>
                        ({qtdItens} {qtdItens === 1 ? 'item' : 'itens'})
                      </span>
                    </strong>
                    {categoria.descricao && <p>{categoria.descricao}</p>}
                  </div>
                  <div className={ui.listAcoes}>
                    {!fixa && (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={!anterior || reordenando}
                          aria-label="Mover categoria para cima"
                          onClick={() => {
                            if (!anterior || !clienteId) return
                            setReordenando(true)
                            void (async () => {
                              try {
                                await trocarOrdemCategoria(
                                  clienteId,
                                  categoria.id,
                                  anterior.id,
                                )
                                const cats = [...dados.categorias]
                                ;[cats[indice - 1], cats[indice]] = [
                                  cats[indice]!,
                                  cats[indice - 1]!,
                                ]
                                setDados({ ...dados, categorias: cats })
                              } catch {
                                setFeedback({
                                  tipo: 'error',
                                  texto: 'Não foi possível reordenar.',
                                })
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
                          disabled={!proxima || reordenando || ehCategoriaFixa(proxima.id)}
                          aria-label="Mover categoria para baixo"
                          onClick={() => {
                            if (!proxima || !clienteId) return
                            setReordenando(true)
                            void (async () => {
                              try {
                                await trocarOrdemCategoria(
                                  clienteId,
                                  categoria.id,
                                  proxima.id,
                                )
                                const cats = [...dados.categorias]
                                ;[cats[indice], cats[indice + 1]] = [
                                  cats[indice + 1]!,
                                  cats[indice]!,
                                ]
                                setDados({ ...dados, categorias: cats })
                              } catch {
                                setFeedback({
                                  tipo: 'error',
                                  texto: 'Não foi possível reordenar.',
                                })
                              } finally {
                                setReordenando(false)
                              }
                            })()
                          }}
                        >
                          ↓
                        </button>
                      </>
                    )}
                    {fixa ? (
                      <Link
                        className="btn btn--ghost"
                        to={`/admin/painel/categorias/${categoria.id}`}
                      >
                        Visualizar
                      </Link>
                    ) : (
                      <>
                        <Link
                          className="btn btn--ghost"
                          to={`/admin/painel/categorias/${categoria.id}`}
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="btn btn--danger-soft"
                          onClick={() => setExcluirId(categoria.id)}
                        >
                          Excluir
                        </button>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <AdminAjuda aberto={ajudaAberta} aoFechar={() => setAjudaAberta(false)} />

      <AdminConfirmacao
        aberto={excluirId !== null}
        titulo="Excluir categoria?"
        descricao="A categoria e os itens vinculados saem do catálogo público (podem ser recuperados no banco). Confirme para continuar."
        confirmarRotulo="Excluir"
        processando={excluindo}
        processandoRotulo="Excluindo…"
        perigo
        aoCancelar={() => {
          if (!excluindo) setExcluirId(null)
        }}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </div>
  )
}
