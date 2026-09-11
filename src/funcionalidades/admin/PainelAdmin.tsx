import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import { excluirCategoriaDb } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import { AdminConfirmacao, AdminMenuMais } from './AdminConfirmacao'
import {
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { useDadosCliente } from './useDadosCliente'
import { useFlashLocation } from './useFlashLocation'

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
    if (!dados || !clienteId || !excluirId) return
    const id = excluirId
    setExcluirId(null)
    try {
      await excluirCategoriaDb(clienteId, id)
      setDados({
        ...dados,
        categorias: dados.categorias.filter((c) => c.id !== id),
        itens: dados.itens.filter((item) => item.categoria !== id),
      })
      setFeedback({ tipo: 'success', texto: 'Categoria excluída.' })
    } catch {
      setFeedback({ tipo: 'error', texto: 'Não foi possível excluir a categoria.' })
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
      <div className="admin-painel">
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
      <div className="admin-painel">
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
    <div className="admin-painel">
      <header className="admin-painel__header">
        <div>
          <p className="admin-painel__eyebrow">Painel do cliente</p>
          <h1>{nomeExibido}</h1>
        </div>
        <div className="admin-painel__acoes">
          <div className="admin-acoes-desktop">
            <Link className="btn btn--ghost" to="/admin/painel/cadastro">
              Atualizar cadastro
            </Link>
            <Link className="btn btn--ghost" to={linkPublico}>
              Ver montagem
            </Link>
            <button type="button" className="btn btn--ghost" onClick={() => void aoSair()}>
              Sair
            </button>
          </div>
          <div className="admin-acoes-mobile">
            <AdminMenuMais
              aberto={menuAberto}
              aoAlternar={() => setMenuAberto((v) => !v)}
            >
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
                to={linkPublico}
                onClick={() => setMenuAberto(false)}
              >
                Ver montagem
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

      <section className="admin-painel__secao">
        <div className="admin-itens__cabecalho">
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
          <ul className="admin-categorias">
            {dados.categorias.map((categoria) => {
              const qtdItens = dados.itens.filter((i) => i.categoria === categoria.id).length
              const fixa = ehCategoriaFixa(categoria.id)
              return (
                <li key={categoria.id} className="admin-categorias__item">
                  <div>
                    <strong>
                      {categoria.rotulo}{' '}
                      {fixa && <span className="admin-categorias__badge">Fixa</span>}
                      <span className="admin-categorias__qtd">
                        ({qtdItens} {qtdItens === 1 ? 'item' : 'itens'})
                      </span>
                    </strong>
                    {categoria.descricao && <p>{categoria.descricao}</p>}
                  </div>
                  <div className="admin-categorias__acoes">
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
                          className="btn btn--danger"
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
        perigo
        aoCancelar={() => setExcluirId(null)}
        aoConfirmar={() => void confirmarExclusao()}
      />
    </div>
  )
}
