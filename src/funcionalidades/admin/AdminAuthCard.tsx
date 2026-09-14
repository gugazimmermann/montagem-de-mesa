import type { FormEvent, ReactNode } from 'react'
import { AdminEstadoCarregando } from './AdminFeedback'
import * as ui from './adminClasses'

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
    <header>
      <h1 className={ui.loginHeaderTitulo}>{titulo}</h1>
      {subtitulo ? <p className={ui.loginHeaderSub}>{subtitulo}</p> : null}
    </header>
  )

  if (asForm) {
    return (
      <div className={ui.loginShell}>
        <form className={ui.loginCard} onSubmit={onSubmit}>
          {Header}
          {children}
          {rodape}
        </form>
      </div>
    )
  }

  return (
    <div className={ui.loginShell}>
      <div className={ui.loginCard}>
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
    <div className={ui.loginShell}>
      <div className={ui.loginCard}>
        <AdminEstadoCarregando mensagem={mensagem} />
      </div>
    </div>
  )
}
