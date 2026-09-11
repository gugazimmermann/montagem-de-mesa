import { supabase } from './supabase'

export class UploadErro extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadErro'
  }
}

const BUCKET_LOGOS = 'logos'
const BUCKET_ITENS = 'itens'
export const TAMANHO_MAX_LOGO = 2 * 1024 * 1024
export const TAMANHO_MAX_ITEM = 5 * 1024 * 1024

const MSG_FORMATO = 'Formato de imagem não suportado. Use WebP, PNG, JPEG ou GIF.'

export const MIME_IMAGEM: Record<string, string> = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
}

function extensaoDoArquivo(arquivo: File): string {
  const porMime = MIME_IMAGEM[arquivo.type]
  if (porMime) return porMime
  throw new UploadErro(MSG_FORMATO)
}

function validarImagem(arquivo: File, tamanhoMax: number, rotuloLimite: string): void {
  if (arquivo.size > tamanhoMax) {
    throw new UploadErro(`A imagem deve ter no máximo ${rotuloLimite}.`)
  }
  if (!arquivo.type || !(arquivo.type in MIME_IMAGEM)) {
    throw new UploadErro(MSG_FORMATO)
  }
}

function contentTypeDoArquivo(arquivo: File): string {
  if (!(arquivo.type in MIME_IMAGEM)) {
    throw new UploadErro(MSG_FORMATO)
  }
  return arquivo.type
}

/** Aceita só URLs públicas do Storage deste projeto. */
export function ehUrlStoragePublicaPermitida(urlTexto: string): boolean {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined
  if (!base || !urlTexto.trim()) return false
  try {
    const url = new URL(urlTexto.trim())
    if (url.protocol !== 'https:') return false
    const origemProjeto = new URL(base).origin
    if (url.origin !== origemProjeto) return false
    return url.pathname.includes('/storage/v1/object/public/')
  } catch {
    return false
  }
}

export function exigirUrlStorageOuVazio(urlTexto: string, rotulo: string): string {
  const trim = urlTexto.trim()
  if (!trim) return ''
  if (!ehUrlStoragePublicaPermitida(trim)) {
    throw new UploadErro(
      `${rotulo} inválida. Use upload ou uma URL pública do Storage deste projeto.`,
    )
  }
  return trim
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
    contentType: contentTypeDoArquivo(arquivo),
    upsert: true,
  })
  if (error) throw new UploadErro('Não foi possível enviar a logo.')

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
    contentType: contentTypeDoArquivo(arquivo),
    upsert: true,
  })
  if (error) throw new UploadErro('Não foi possível enviar a imagem.')

  const { data } = supabase.storage.from(BUCKET_ITENS).getPublicUrl(objectKey)
  return data.publicUrl
}
