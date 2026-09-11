import { useRef, useState } from 'react'
import { ImagemAmpliada } from '../../compartilhado/ImagemAmpliada'

type AmpliarImagemProps = {
  src: string
  alt: string
}

export function AmpliarImagem({ src, alt }: AmpliarImagemProps) {
  const [aberto, setAberto] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="admin-itens__preview admin-itens__preview--clicavel"
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
