import { useEffect, useId, useRef, type ReactNode } from 'react'
import './AdminFeedback.css'

type PropsConfirmacao = {
  aberto: boolean
  titulo: string
  descricao: string
  confirmarRotulo?: string
  cancelarRotulo?: string
  processando?: boolean
  processandoRotulo?: string
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
  processando = false,
  processandoRotulo = 'Processando…',
  perigo = false,
  aoConfirmar,
  aoCancelar,
}: PropsConfirmacao) {
  const tituloId = useId()
  const descricaoId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!aberto) return
    if (!processando) cancelarRef.current?.focus()

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !processando) {
        aoCancelar()
        return
      }
      if (evento.key !== 'Tab' || !dialogRef.current) return

      const focaveis = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', aoTecla)
    }
  }, [aberto, aoCancelar, processando])

  if (!aberto) return null

  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onClick={processando ? undefined : aoCancelar}
    >
      <div
        ref={dialogRef}
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        aria-busy={processando}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={tituloId}>{titulo}</h2>
        <p id={descricaoId}>{descricao}</p>
        <div className="admin-modal__acoes">
          <button
            ref={cancelarRef}
            type="button"
            className="btn btn--ghost"
            disabled={processando}
            onClick={aoCancelar}
          >
            {cancelarRotulo}
          </button>
          <button
            type="button"
            className={perigo ? 'btn btn--danger' : 'btn btn--primary'}
            disabled={processando}
            onClick={aoConfirmar}
          >
            {processando ? processandoRotulo : confirmarRotulo}
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
  aoFechar?: () => void
  rotulo?: string
}

export function AdminMenuMais({
  children,
  aberto,
  aoAlternar,
  aoFechar,
  rotulo = 'Mais',
}: PropsMenuMais) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const aoFecharRef = useRef(aoFechar)
  const aoAlternarRef = useRef(aoAlternar)
  aoFecharRef.current = aoFechar
  aoAlternarRef.current = aoAlternar

  useEffect(() => {
    if (!aberto) return

    function fechar() {
      if (aoFecharRef.current) aoFecharRef.current()
      else aoAlternarRef.current()
    }

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar()
    }

    function aoPointer(evento: MouseEvent) {
      if (!rootRef.current?.contains(evento.target as Node)) fechar()
    }

    document.addEventListener('keydown', aoTecla)
    document.addEventListener('mousedown', aoPointer)
    return () => {
      document.removeEventListener('keydown', aoTecla)
      document.removeEventListener('mousedown', aoPointer)
    }
  }, [aberto])

  return (
    <div ref={rootRef} className={`admin-menu-mais ${aberto ? 'is-open' : ''}`}>
      <button
        type="button"
        className="btn btn--ghost admin-menu-mais__trigger"
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={aoAlternar}
      >
        {rotulo}
      </button>
      {aberto && (
        <div id={menuId} className="admin-menu-mais__painel" role="menu">
          {children}
        </div>
      )}
    </div>
  )
}
