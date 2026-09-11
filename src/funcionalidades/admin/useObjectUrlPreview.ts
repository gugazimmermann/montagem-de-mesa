import { useEffect, useState, type ChangeEvent } from 'react'

const ACCEPT_IMAGEM = 'image/webp,image/png,image/jpeg,image/gif'

export function useObjectUrlPreview() {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function escolher(evento: ChangeEvent<HTMLInputElement>) {
    const proximo = evento.target.files?.[0]
    if (!proximo) return
    if (preview) URL.revokeObjectURL(preview)
    setArquivo(proximo)
    setPreview(URL.createObjectURL(proximo))
  }

  function limpar() {
    if (preview) URL.revokeObjectURL(preview)
    setArquivo(null)
    setPreview(null)
  }

  return { arquivo, preview, escolher, limpar, accept: ACCEPT_IMAGEM }
}
