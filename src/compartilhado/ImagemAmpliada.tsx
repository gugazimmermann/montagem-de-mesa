import { useEffect, useId, useRef, type RefObject } from 'react'
import './ImagemAmpliada.css'

type ImagemAmpliadaProps = {
  src: string
  alt: string
  aberto: boolean
  aoFechar: () => void
  triggerRef?: RefObject<HTMLElement | null>
}

export function ImagemAmpliada({
  src,
  alt,
  aberto,
  aoFechar,
  triggerRef,
}: ImagemAmpliadaProps) {
  const tituloId = useId()
  const fecharRef = useRef<HTMLButtonElement>(null)
  const aoFecharRef = useRef(aoFechar)
  aoFecharRef.current = aoFechar

  useEffect(() => {
    if (!aberto) return

    const trigger = triggerRef?.current
    fecharRef.current?.focus()

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') aoFecharRef.current()
      if (evento.key !== 'Tab') return

      evento.preventDefault()
      fecharRef.current?.focus()
    }

    document.addEventListener('keydown', aoTecla)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTecla)
      document.body.style.overflow = overflowAnterior
      trigger?.focus()
    }
  }, [aberto, triggerRef])

  if (!aberto) return null

  return (
    <div
      className="imagem-ampliada"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      onClick={() => aoFecharRef.current()}
    >
      <div className="imagem-ampliada__conteudo" onClick={(e) => e.stopPropagation()}>
        <p id={tituloId} className="imagem-ampliada__titulo">
          {alt}
        </p>
        <button
          ref={fecharRef}
          type="button"
          className="imagem-ampliada__fechar"
          onClick={() => aoFecharRef.current()}
          aria-label="Fechar"
        >
          Fechar
        </button>
        <img src={src} alt={alt} className="imagem-ampliada__img" />
      </div>
    </div>
  )
}
