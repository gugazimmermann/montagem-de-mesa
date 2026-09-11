import { useEffect, useId, useState } from 'react'

type AmpliarImagemProps = {
  src: string
  alt: string
}

export function AmpliarImagem({ src, alt }: AmpliarImagemProps) {
  const [aberto, setAberto] = useState(false)
  const tituloId = useId()

  useEffect(() => {
    if (!aberto) return

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setAberto(false)
    }

    document.addEventListener('keydown', aoTecla)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTecla)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto])

  return (
    <>
      <button
        type="button"
        className="admin-itens__preview admin-itens__preview--clicavel"
        onClick={() => setAberto(true)}
        aria-label={`Ampliar imagem de ${alt}`}
      >
        <img src={src} alt="" />
      </button>

      {aberto && (
        <div
          className="admin-imagem-ampliada"
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          onClick={() => setAberto(false)}
        >
          <div
            className="admin-imagem-ampliada__conteudo"
            onClick={(e) => e.stopPropagation()}
          >
            <p id={tituloId} className="admin-imagem-ampliada__titulo">
              {alt}
            </p>
            <button
              type="button"
              className="admin-imagem-ampliada__fechar"
              onClick={() => setAberto(false)}
              aria-label="Fechar"
            >
              Fechar
            </button>
            <img src={src} alt={alt} className="admin-imagem-ampliada__img" />
          </div>
        </div>
      )}
    </>
  )
}
