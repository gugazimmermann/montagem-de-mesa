import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import { excluirCategoriaDb } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import { AdminBannerTrial } from './AdminBannerTrial'
import { AdminConfirmacao, AdminMenuMais } from './AdminConfirmacao'
import {
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { useDadosCliente } from './useDadosCliente'
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
  const [excluirId, setExcluirId] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)

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
      <header className={ui.painelHeader}>
        <div>
          <p className={ui.painelEyebrow}>Painel do cliente</p>
          <h1 className={ui.painelTitulo}>{nomeExibido}</h1>
        </div>
        <div className={ui.painelAcoes}>
          <div className={ui.acoesDesktop}>
            <Link className="btn btn--ghost" to={linkPublico}>
              Ver montagem
            </Link>
            <Link className="btn btn--ghost" to="/admin/painel/montagens">
              Montagens enviadas
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
            {dados.categorias.map((categoria) => {
              const qtdItens = dados.itens.filter((i) => i.categoria === categoria.id).length
              const fixa = ehCategoriaFixa(categoria.id)
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

      <AdminConfirmacao
        aberto={excluirId !== null}
        titulo="Excluir categoria?"
        descricao="Os itens vinculados também serão removidos. Esta ação não pode ser desfeita."
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
