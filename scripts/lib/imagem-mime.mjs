/** Espelho de `src/dados/storage.ts` — manter alinhado. */

export const MIME_POR_EXT = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
}

export const EXT_POR_MIME = {
  'image/webp': 'webp',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
}

export const EXTS_IMAGEM = new Set(Object.keys(MIME_POR_EXT))

export const TAMANHO_MAX_LOGO = 2 * 1024 * 1024
export const TAMANHO_MAX_ITEM = 5 * 1024 * 1024

export const BUCKET_LOGOS = 'logos'
export const BUCKET_ITENS = 'itens'

export const MIME_TYPES_LISTA = Object.keys(EXT_POR_MIME)
