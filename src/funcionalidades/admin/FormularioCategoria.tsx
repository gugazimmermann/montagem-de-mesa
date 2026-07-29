import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Categoria } from '../../compartilhado/tipos'
import {
  carregarDadosCliente,
  criarCategoria,
  slugifyCategoria,
} from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import './PainelAdmin.css'
import './LoginAdmin.css'

export function FormularioCategoria() {
  const navegar = useNavigate()
  const { cliente } = useAuth()
  const clienteId = cliente!.id

  const [rotulo, setRotulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function salvarCategoria(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    const rotuloTrim = rotulo.trim()
    if (!rotuloTrim) {
      setErro('Informe o rótulo da categoria.')
      return
    }

    setEnviando(true)
    try {
      const dadosAtuais = await carregarDadosCliente(clienteId)
      if (!dadosAtuais) {
        setErro('Cliente não encontrado.')
        return
      }

      let id = slugifyCategoria(rotuloTrim)
      const idsExistentes = new Set(dadosAtuais.categorias.map((c) => c.id))
      if (idsExistentes.has(id)) {
        id = `${id}-${Date.now()}`
      }

      const nova: Categoria = {
        id,
        rotulo: rotuloTrim,
        descricao: descricao.trim(),
      }

      await criarCategoria(clienteId, nova)
      navegar(`/admin/painel/categorias/${id}`)
    } catch {
      setErro('Não foi possível criar a categoria.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="admin-painel">
      <header className="admin-painel__header">
        <div>
          <p className="admin-painel__eyebrow">Categorias</p>
          <h1>Nova categoria</h1>
        </div>
        <div className="admin-painel__acoes">
          <Link className="btn btn--ghost" to="/admin/painel">
            Voltar
          </Link>
        </div>
      </header>

      {erro && (
        <p className="admin-painel__alerta admin-painel__alerta--erro" role="alert">
          {erro}
        </p>
      )}

      <section className="admin-painel__secao">
        <form className="admin-painel__form" onSubmit={(e) => void salvarCategoria(e)}>
          <label className="admin-field">
            <span>Rótulo</span>
            <input
              type="text"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              required
              disabled={enviando}
            />
          </label>

          <label className="admin-field">
            <span>Descrição</span>
            <textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={enviando}
            />
          </label>

          <div className="admin-painel__form-acoes">
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Criando…' : 'Criar categoria'}
            </button>
            <Link className="btn btn--ghost" to="/admin/painel">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
