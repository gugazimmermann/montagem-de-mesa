import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Categoria } from '../../compartilhado/tipos'
import { criarCategoria } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import {
  AdminAlertaErro,
  AdminPaginaPainel,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import * as ui from './adminClasses'
import { OPCOES_CODIGO_CATEGORIA } from './opcoesCodigoCategoria'

export function FormularioCategoria() {
  const navegar = useNavigate()
  const { cliente } = useAuth()

  const [rotulo, setRotulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [codigo, setCodigo] = useState('sousplat')
  const [erro, setErro] = useState<string | null>(null)
  const [erroRotulo, setErroRotulo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!cliente) {
    return <AdminSessaoInvalida />
  }

  const clienteId = cliente.id
  const dicaCodigo =
    OPCOES_CODIGO_CATEGORIA.find((o) => o.valor === codigo)?.dica ?? ''

  async function salvarCategoria(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setErroRotulo(null)

    const rotuloTrim = rotulo.trim()
    if (!rotuloTrim) {
      setErroRotulo('Informe o rótulo da categoria.')
      return
    }

    setEnviando(true)
    try {
      const id = crypto.randomUUID()
      const nova: Categoria = {
        id,
        codigo: codigo || null,
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
      <section className={ui.painelSecao}>
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
              disabled={enviando}
              aria-invalid={erroRotulo ? true : undefined}
              aria-describedby={erroRotulo ? 'erro-rotulo-nova' : undefined}
            />
            {erroRotulo && (
              <span id="erro-rotulo-nova" className={ui.fieldErro} role="alert">
                {erroRotulo}
              </span>
            )}
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Tipo de layout na mesa</span>
            <select
              className={ui.fieldInput}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              disabled={enviando}
              aria-describedby="dica-codigo-nova"
            >
              {OPCOES_CODIGO_CATEGORIA.map((op) => (
                <option key={op.valor || 'generico'} value={op.valor}>
                  {op.rotulo}
                </option>
              ))}
            </select>
            <span id="dica-codigo-nova" className={ui.fieldDica}>
              {dicaCodigo} Define a posição na pré-visualização.
            </span>
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Descrição</span>
            <textarea
              className={ui.fieldInput}
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={enviando}
            />
          </label>

          <div className={ui.painelFormAcoes}>
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
