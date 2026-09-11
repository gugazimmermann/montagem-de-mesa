import { supabase } from './supabase'

const BUCKET_LOGOS = 'logos'
const BUCKET_ITENS = 'itens'
const TAMANHO_MAX_LOGO = 2 * 1024 * 1024
const TAMANHO_MAX_ITEM = 5 * 1024 * 1024

const MIME_IMAGEM: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

function extensaoDoArquivo(arquivo: File): string {
  const porMime = MIME_IMAGEM[arquivo.type]
  if (porMime) return porMime

  const nome = arquivo.name.toLowerCase()
  const ponto = nome.lastIndexOf('.')
  if (ponto < 0) return 'webp'
  const ext = nome.slice(ponto + 1)
  if (ext === 'jpeg') return 'jpg'
  if (['webp', 'png', 'jpg', 'gif', 'svg'].includes(ext)) return ext
  return 'webp'
}

function validarImagem(arquivo: File, tamanhoMax: number, rotuloLimite: string): void {
  if (arquivo.size > tamanhoMax) {
    throw new Error(`A imagem deve ter no máximo ${rotuloLimite}.`)
  }
  if (arquivo.type && !(arquivo.type in MIME_IMAGEM)) {
    throw new Error('Formato de imagem não suportado. Use WebP, PNG, JPEG, GIF ou SVG.')
  }
}

function contentTypeDoArquivo(arquivo: File, ext: string): string {
  return (
    Object.entries(MIME_IMAGEM).find(([, e]) => e === ext)?.[0] ??
    (arquivo.type || 'image/webp')
  )
}

/** Envia a logo para o bucket `logos` como `{clienteId}.{ext}` e retorna a URL pública. */
export async function enviarLogoStorage(
  clienteId: string,
  arquivo: File,
): Promise<string> {
  validarImagem(arquivo, TAMANHO_MAX_LOGO, '2 MB')

  const ext = extensaoDoArquivo(arquivo)
  const objectKey = `${clienteId}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_LOGOS).upload(objectKey, arquivo, {
    contentType: contentTypeDoArquivo(arquivo, ext),
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET_LOGOS).getPublicUrl(objectKey)
  return data.publicUrl
}

/** Envia imagem de item para `itens` como `{clienteId}/{categoriaId}/{itemId}.{ext}`. */
export async function enviarImagemItemStorage(
  clienteId: string,
  categoriaId: string,
  itemId: string,
  arquivo: File,
): Promise<string> {
  validarImagem(arquivo, TAMANHO_MAX_ITEM, '5 MB')

  const ext = extensaoDoArquivo(arquivo)
  const objectKey = `${clienteId}/${categoriaId}/${itemId}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_ITENS).upload(objectKey, arquivo, {
    contentType: contentTypeDoArquivo(arquivo, ext),
    upsert: true,
  })
  if (error) throw error

  const { data } = supabase.storage.from(BUCKET_ITENS).getPublicUrl(objectKey)
  return data.publicUrl
}
