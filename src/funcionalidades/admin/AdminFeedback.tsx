import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import './AdminFeedback.css'

export type TipoAlerta = 'info' | 'success' | 'warning' | 'error'

type PropsAdminAlerta = {
  tipo: TipoAlerta
  titulo?: string
  children: ReactNode
}

export function AdminAlerta({ tipo, titulo, children }: PropsAdminAlerta) {
  const role = tipo === 'error' ? 'alert' : 'status'
  return (
    <div className={`admin-alerta admin-alerta--${tipo}`} role={role}>
      {titulo && <p className="admin-alerta__titulo">{titulo}</p>}
      <div className="admin-alerta__corpo">{children}</div>
    </div>
  )
}

type PropsAdminEstado = {
  mensagem?: string
}

export function AdminEstadoCarregando({
  mensagem = 'Carregando…',
}: PropsAdminEstado) {
  return (
    <div className="admin-estado" role="status" aria-live="polite" aria-busy="true">
      <span className="admin-estado__spinner" aria-hidden="true" />
      <p>{mensagem}</p>
    </div>
  )
}

type PropsAdminEstadoVazio = {
  titulo: string
  descricao?: string
  acao?: ReactNode
}

export function AdminEstadoVazio({
  titulo,
  descricao,
  acao,
}: PropsAdminEstadoVazio) {
  return (
    <div className="admin-estado admin-estado--vazio">
      <p className="admin-estado__titulo">{titulo}</p>
      {descricao && <p className="admin-estado__desc">{descricao}</p>}
      {acao}
    </div>
  )
}

type PropsAdminBreadcrumb = {
  itens: { rotulo: string; para?: string }[]
}

export function AdminBreadcrumb({ itens }: PropsAdminBreadcrumb) {
  return (
    <nav className="admin-breadcrumb" aria-label="Navegação">
      <ol>
        {itens.map((item, i) => (
          <li key={`${item.rotulo}-${i}`}>
            {item.para ? (
              <Link to={item.para}>{item.rotulo}</Link>
            ) : (
              <span aria-current="page">{item.rotulo}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
