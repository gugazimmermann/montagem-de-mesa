import { useEffect, useState, type ImgHTMLAttributes } from 'react'

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  src: string
}

/** Mantém a foto anterior na tela até a URL nova carregar. */
export function ImagemEstavel({ src, alt = '', ...resto }: Props) {
  const [exibida, setExibida] = useState(src)

  useEffect(() => {
    if (!src || src === exibida) return
    let cancelado = false
    const img = new Image()
    img.onload = () => {
      if (!cancelado) setExibida(src)
    }
    img.src = src
    return () => {
      cancelado = true
    }
  }, [src, exibida])

  if (!exibida) return null
  return <img src={exibida} alt={alt} {...resto} />
}
