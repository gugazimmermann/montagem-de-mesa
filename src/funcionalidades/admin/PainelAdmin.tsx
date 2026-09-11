import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { DadosCliente } from '../../compartilhado/tipos'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import {
  carregarDadosCliente,
  excluirCategoriaDb,
} from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import './PainelAdmin.css'
import './LoginAdmin.css'
import './EditarCategoria.css'

export function PainelAdmin() {
  const navegar = useNavigate()
  const { cliente, sair } = useAuth()
  const clienteId = cliente!.id

  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let ativo = true
    void carregarDadosCliente(clienteId)
      .then((d) => {
        if (!ativo || !d) return
        setDados(d)
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar o painel.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [clienteId])

  const linkPublico = useMemo(
    () => (cliente ? `/${cliente.slug}` : '/'),
    [cliente],
  )

  async function excluirCategoria(id: string) {
    if (!dados) return
    const ok = window.confirm(
      'Excluir esta categoria? Os itens vinculados também serão removidos.',
    )
    if (!ok) return

    try {
      await excluirCategoriaDb(clienteId, id)
      setDados({
        ...dados,
        categorias: dados.categorias.filter((c) => c.id !== id),
        itens: dados.itens.filter((item) => item.categoria !== id),
      })
      setMensagem('Categoria excluída.')
    } catch {
      setErro('Não foi possível excluir a categoria.')
    }
  }

  async function aoSair() {
    await sair()
    navegar('/admin', { replace: true })
  }

  if (carregando || !dados) {
    return (
      <div className="admin-painel">
        <p className="admin-painel__alerta">Carregando painel…</p>
        {erro && (
          <p className="admin-painel__alerta admin-painel__alerta--erro" role="alert">
            {erro}
          </p>
        )}
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
        <div className="admin-itens__cabecalho">
          <h2>Categorias ({dados.categorias.length})</h2>
          <Link className="btn btn--primary" to="/admin/painel/categorias/novo">
            Nova categoria
          </Link>
        </div>

        <ul className="admin-categorias">
          {dados.categorias.length === 0 && (
            <li className="admin-categorias__vazio">Nenhuma categoria ainda.</li>
          )}
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
                        className="btn btn--ghost"
                        onClick={() => void excluirCategoria(categoria.id)}
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
      </section>
    </div>
  )
}
