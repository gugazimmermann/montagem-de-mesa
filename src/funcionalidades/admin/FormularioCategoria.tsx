import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import type { Categoria } from '../../compartilhado/tipos'
import { criarCategoria } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import {
  AdminAlertaErro,
  AdminPaginaPainel,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'

export function FormularioCategoria() {
  const navegar = useNavigate()
  const { cliente } = useAuth()

  const [rotulo, setRotulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!cliente) {
    return <AdminSessaoInvalida />
  }

  const clienteId = cliente.id

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
      const id = uuidv4()
      const nova: Categoria = {
        id,
        rotulo: rotuloTrim,
        descricao: descricao.trim(),
      }
      await criarCategoria(clienteId, nova)
      navegar(`/admin/painel/categorias/${id}`, {
        state: { flash: 'Categoria criada.' },
      })
    } catch {
      setErro('Não foi possível criar a categoria.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AdminPaginaPainel
      titulo="Nova categoria"
      breadcrumb={[
        { rotulo: 'Painel', para: '/admin/painel' },
        { rotulo: 'Nova categoria' },
      ]}
      voltarPara="/admin/painel"
      alerta={erro ? <AdminAlertaErro>{erro}</AdminAlertaErro> : null}
    >
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
    </AdminPaginaPainel>
  )
}
