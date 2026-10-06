import { useRef, useState } from 'react'
import { ImagemAmpliada } from '../../compartilhado/ImagemAmpliada'
import * as ui from './adminClasses'

type AmpliarImagemProps = {
  src: string
  alt: string
  className?: string
}

export function AmpliarImagem({
  src,
  alt,
  className = ui.itensPreviewClicavel,
}: AmpliarImagemProps) {
  const [aberto, setAberto] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        onClick={() => setAberto(true)}
        aria-label={`Ampliar imagem de ${alt}`}
      >
        <img src={src} alt="" />
      </button>

      <ImagemAmpliada
        src={src}
        alt={alt}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        triggerRef={triggerRef}
      />
    </>
  )
}
