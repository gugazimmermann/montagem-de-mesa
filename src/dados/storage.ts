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
/** TTL das URLs assinadas (1h). */
export const TTL_URL_ASSINADA_SEG = 60 * 60

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

/** Redimensiona/comprime no client antes do upload (max 1600px, JPEG/WebP quality). */
export async function comprimirImagemParaUpload(
  arquivo: File,
  maxLado = 1600,
): Promise<File> {
  if (!arquivo.type.startsWith('image/') || arquivo.type === 'image/gif') {
    return arquivo
  }

  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height))
    if (escala >= 1 && arquivo.size <= 800 * 1024) {
      bitmap.close()
      return arquivo
    }

    const w = Math.round(bitmap.width * escala)
    const h = Math.round(bitmap.height * escala)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return arquivo
    }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()

    const tipoSaida =
      arquivo.type === 'image/png' || arquivo.type === 'image/webp'
        ? arquivo.type
        : 'image/jpeg'
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, tipoSaida, 0.85),
    )
    if (!blob) return arquivo

    const ext = MIME_IMAGEM[tipoSaida] ?? 'jpg'
    const nomeBase = arquivo.name.replace(/\.[^.]+$/, '') || 'imagem'
    return new File([blob], `${nomeBase}.${ext}`, { type: tipoSaida })
  } catch {
    return arquivo
  }
}

export type OpcoesUrlStorage = {
  clienteId?: string
  tipo?: 'logo' | 'item'
}

const RE_PATH_LOGO = /^[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$/i
const RE_PATH_ITEM =
  /^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$/i

/** Extrai o object path a partir de path puro ou URL (public/sign). */
export function extrairPathStorage(
  urlOuPath: string,
  bucket: 'logos' | 'itens',
): string | null {
  const trim = urlOuPath.trim()
  if (!trim) return null

  if (bucket === 'logos' && RE_PATH_LOGO.test(trim)) return trim
  if (bucket === 'itens' && RE_PATH_ITEM.test(trim)) return trim

  try {
    const url = new URL(trim)
    const marker = `/storage/v1/object/`
    const idx = url.pathname.indexOf(marker)
    if (idx < 0) return null
    const resto = url.pathname.slice(idx + marker.length)
    // public/logos/... | sign/logos/...
    const partes = resto.split('/')
    if (partes.length < 2) return null
    const bucketNaUrl = partes[1]
    if (bucketNaUrl !== bucket) return null
    return partes.slice(2).join('/')
  } catch {
    return null
  }
}

export function ehPathOuUrlStoragePermitida(
  urlTexto: string,
  opcoes?: OpcoesUrlStorage,
): boolean {
  const trim = urlTexto.trim()
  if (!trim) return false

  if (opcoes?.tipo === 'logo') {
    const path = extrairPathStorage(trim, 'logos')
    if (!path) return false
    if (opcoes.clienteId && !path.startsWith(`${opcoes.clienteId}.`)) return false
    return true
  }

  if (opcoes?.tipo === 'item') {
    const path = extrairPathStorage(trim, 'itens')
    if (!path) return false
    if (opcoes.clienteId && !path.startsWith(`${opcoes.clienteId}/`)) return false
    return true
  }

  return (
    extrairPathStorage(trim, 'logos') != null ||
    extrairPathStorage(trim, 'itens') != null
  )
}

/** @deprecated use ehPathOuUrlStoragePermitida */
export function ehUrlStoragePublicaPermitida(
  urlTexto: string,
  opcoes?: OpcoesUrlStorage,
): boolean {
  return ehPathOuUrlStoragePermitida(urlTexto, opcoes)
}

export function exigirUrlStorageOuVazio(
  urlTexto: string,
  rotulo: string,
  opcoes?: OpcoesUrlStorage,
): string {
  const trim = urlTexto.trim()
  if (!trim) return ''
  if (!ehPathOuUrlStoragePermitida(trim, opcoes)) {
    throw new UploadErro(
      `${rotulo} inválida. Use upload ou um arquivo do Storage deste projeto${
        opcoes?.clienteId ? ' (do seu cliente)' : ''
      }.`,
    )
  }
  const bucket = opcoes?.tipo === 'logo' ? 'logos' : 'itens'
  return extrairPathStorage(trim, bucket) ?? trim
}

async function assinarPaths(
  bucket: 'logos' | 'itens',
  paths: string[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(paths.filter(Boolean))]
  const mapa = new Map<string, string>()
  if (unicos.length === 0) return mapa

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unicos, TTL_URL_ASSINADA_SEG)

  if (error || !data) {
    console.warn('createSignedUrls', bucket, error)
    return mapa
  }

  for (const item of data) {
    if (item.path && item.signedUrl) {
      mapa.set(item.path, item.signedUrl)
    }
  }
  return mapa
}

/** Resolve path ou URL legado para URL assinada (ou a própria se já for http). */
export async function resolverUrlAssinada(
  urlOuPath: string | undefined | null,
  bucket: 'logos' | 'itens',
): Promise<string | undefined> {
  if (!urlOuPath?.trim()) return undefined
  const path = extrairPathStorage(urlOuPath, bucket)
  if (!path) {
    if (/^https?:\/\//i.test(urlOuPath)) return urlOuPath
    return undefined
  }
  const mapa = await assinarPaths(bucket, [path])
  return mapa.get(path) ?? undefined
}

export async function resolverUrlsAssinadasEmLote(
  entradas: { valor: string; bucket: 'logos' | 'itens' }[],
): Promise<Map<string, string>> {
  const porBucket: Record<'logos' | 'itens', string[]> = { logos: [], itens: [] }
  const chaveOriginal = new Map<string, string>()

  for (const { valor, bucket } of entradas) {
    const path = extrairPathStorage(valor, bucket)
    if (path) {
      porBucket[bucket].push(path)
      chaveOriginal.set(`${bucket}:${path}`, valor)
    } else if (/^https?:\/\//i.test(valor)) {
      chaveOriginal.set(`raw:${valor}`, valor)
    }
  }

  const [logos, itens] = await Promise.all([
    assinarPaths('logos', porBucket.logos),
    assinarPaths('itens', porBucket.itens),
  ])

  const resultado = new Map<string, string>()
  for (const [path, signed] of logos) {
    const original = chaveOriginal.get(`logos:${path}`)
    if (original) resultado.set(original, signed)
    resultado.set(path, signed)
  }
  for (const [path, signed] of itens) {
    const original = chaveOriginal.get(`itens:${path}`)
    if (original) resultado.set(original, signed)
    resultado.set(path, signed)
  }
  for (const [k, v] of chaveOriginal) {
    if (k.startsWith('raw:')) resultado.set(v, v)
  }
  return resultado
}

/** Envia a logo e retorna o path do objeto (`{clienteId}.{ext}`). */
export async function enviarLogoStorage(
  clienteId: string,
  arquivo: File,
): Promise<string> {
  const comprimido = await comprimirImagemParaUpload(arquivo)
  validarImagem(comprimido, TAMANHO_MAX_LOGO, '2 MB')

  const ext = extensaoDoArquivo(comprimido)
  const objectKey = `${clienteId}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_LOGOS).upload(objectKey, comprimido, {
    contentType: contentTypeDoArquivo(comprimido),
    upsert: true,
  })
  if (error) throw new UploadErro('Não foi possível enviar a logo.')

  return objectKey
}

/** Envia imagem de item e retorna o path (`{clienteId}/{categoriaId}/{itemId}.{ext}`). */
export async function enviarImagemItemStorage(
  clienteId: string,
  categoriaId: string,
  itemId: string,
  arquivo: File,
): Promise<string> {
  const comprimido = await comprimirImagemParaUpload(arquivo)
  validarImagem(comprimido, TAMANHO_MAX_ITEM, '5 MB')

  const ext = extensaoDoArquivo(comprimido)
  const objectKey = `${clienteId}/${categoriaId}/${itemId}.${ext}`

  const { error } = await supabase.storage.from(BUCKET_ITENS).upload(objectKey, comprimido, {
    contentType: contentTypeDoArquivo(comprimido),
    upsert: true,
  })
  if (error) throw new UploadErro('Não foi possível enviar a imagem.')

  return objectKey
}
