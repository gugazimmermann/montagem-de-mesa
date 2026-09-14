import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import * as ui from './adminClasses'

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
      className={ui.modalBackdrop}
      role="presentation"
      onClick={processando ? undefined : aoCancelar}
    >
      <div
        ref={dialogRef}
        className={ui.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={descricaoId}
        aria-busy={processando}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={tituloId}>{titulo}</h2>
        <p id={descricaoId}>{descricao}</p>
        <div className={ui.modalAcoes}>
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
  const painelRef = useRef<HTMLDivElement>(null)
  const aoFecharRef = useRef(aoFechar)
  const aoAlternarRef = useRef(aoAlternar)
  aoFecharRef.current = aoFechar
  aoAlternarRef.current = aoAlternar

  const [posicao, setPosicao] = useState({ up: false, start: false })

  useLayoutEffect(() => {
    if (!aberto) {
      setPosicao({ up: false, start: false })
      return
    }

    function medir() {
      const trigger = rootRef.current?.querySelector('[data-menu-trigger]')
      const painel = painelRef.current
      if (!(trigger instanceof HTMLElement) || !painel) return

      const tr = trigger.getBoundingClientRect()
      const ph = painel.offsetHeight
      const pw = Math.max(painel.offsetWidth, painel.scrollWidth)
      const espacoAbaixo = window.innerHeight - tr.bottom
      const espacoAcima = tr.top
      const up = espacoAbaixo < ph + 12 && espacoAcima > espacoAbaixo
      const start = tr.right - pw < 8 && tr.left + pw <= window.innerWidth - 8
      setPosicao({ up, start })
    }

    medir()
    window.addEventListener('resize', medir)
    window.addEventListener('scroll', medir, true)
    return () => {
      window.removeEventListener('resize', medir)
      window.removeEventListener('scroll', medir, true)
    }
  }, [aberto, children])

  useEffect(() => {
    if (!aberto) return

    function fechar() {
      if (aoFecharRef.current) aoFecharRef.current()
      else aoAlternarRef.current()
    }

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fechar()
    }

    function aoPointer(evento: PointerEvent) {
      if (!rootRef.current?.contains(evento.target as Node)) fechar()
    }

    document.addEventListener('keydown', aoTecla)
    document.addEventListener('pointerdown', aoPointer)
    return () => {
      document.removeEventListener('keydown', aoTecla)
      document.removeEventListener('pointerdown', aoPointer)
    }
  }, [aberto])

  const painelClasses = [
    ui.menuMaisPainel,
    posicao.up ? ui.menuMaisPainelUp : '',
    posicao.start ? ui.menuMaisPainelStart : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={rootRef} className={ui.menuMais}>
      <button
        type="button"
        data-menu-trigger
        className="btn btn--ghost"
        aria-expanded={aberto}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={aoAlternar}
      >
        {rotulo}
      </button>
      {aberto && (
        <div
          ref={painelRef}
          id={menuId}
          className={painelClasses}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  )
}
