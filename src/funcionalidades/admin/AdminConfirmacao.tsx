import { useEffect, useId, useRef, type ReactNode } from 'react'
import './AdminFeedback.css'

type PropsConfirmacao = {
  aberto: boolean
  titulo: string
  descricao: string
  confirmarRotulo?: string
  cancelarRotulo?: string
  perigo?: boolean
  aoConfirmar: () => void
  aoCancelar: () => void
}

export function AdminConfirmacao({
  aberto,
  titulo,
  descricao,
  confirmarRotulo = 'Confirmar',
  cancelarRotulo = 'Cancelar',
  perigo = false,
  aoConfirmar,
  aoCancelar,
}: PropsConfirmacao) {
  const tituloId = useId()
  const cancelarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    cancelarRef.current?.focus()

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoCancelar()
    }

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', aoTecla)
    }
  }, [aberto, aoCancelar])

  if (!aberto) return null

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={aoCancelar}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={tituloId}>{titulo}</h2>
        <p>{descricao}</p>
        <div className="admin-modal__acoes">
          <button
            ref={cancelarRef}
            type="button"
            className="btn btn--ghost"
            onClick={aoCancelar}
          >
            {cancelarRotulo}
          </button>
          <button
            type="button"
            className={perigo ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={aoConfirmar}
          >
            {confirmarRotulo}
          </button>
        </div>
      </div>
    </div>
  )
}

type PropsMenuMais = {
  children: ReactNode
  aberto: boolean
  aoAlternar: () => void
  rotulo?: string
}

export function AdminMenuMais({
  children,
  aberto,
  aoAlternar,
  rotulo = 'Mais',
}: PropsMenuMais) {
  return (
    <div className={`admin-menu-mais ${aberto ? 'is-open' : ''}`}>
      <button
        type="button"
        className="btn btn--ghost admin-menu-mais__trigger"
        aria-expanded={aberto}
        aria-haspopup="menu"
        onClick={aoAlternar}
      >
        {rotulo}
      </button>
      {aberto && (
        <div className="admin-menu-mais__painel" role="menu">
          {children}
        </div>
      )}
    </div>
  )
}
