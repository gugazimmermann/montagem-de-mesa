import type { FormEvent, ReactNode } from 'react'
import { AdminEstadoCarregando } from './AdminFeedback'
import './LoginAdmin.css'
import './admin-ui.css'

type PropsAdminAuthCard = {
  titulo: string
  subtitulo?: string
  asForm?: boolean
  onSubmit?: (evento: FormEvent) => void
  rodape?: ReactNode
  children: ReactNode
}

export function AdminAuthCard({
  titulo,
  subtitulo,
  asForm = false,
  onSubmit,
  rodape,
  children,
}: PropsAdminAuthCard) {
  const Header = (
    <header className="admin-login__header">
      <h1>{titulo}</h1>
      {subtitulo ? <p>{subtitulo}</p> : null}
    </header>
  )

  if (asForm) {
    return (
      <div className="admin-login">
        <form className="admin-login__card" onSubmit={onSubmit}>
          {Header}
          {children}
          {rodape}
        </form>
      </div>
    )
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        {Header}
        {children}
        {rodape}
      </div>
    </div>
  )
}

export function AdminAuthCarregando({
  mensagem = 'Carregando…',
}: {
  mensagem?: string
}) {
  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <AdminEstadoCarregando mensagem={mensagem} />
      </div>
    </div>
  )
}
