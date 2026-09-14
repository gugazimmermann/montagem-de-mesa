import { createClient } from '@supabase/supabase-js'
import {
  BUCKET_ITENS,
  BUCKET_LOGOS,
  MIME_TYPES_LISTA,
  TAMANHO_MAX_ITEM,
  TAMANHO_MAX_LOGO,
} from './imagem-mime.mjs'

export function exigirUrlEServiceKey() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error(
      'Defina no .env: VITE_SUPABASE_URL (https://SEU_REF.supabase.co) e SUPABASE_SERVICE_ROLE_KEY.',
    )
    process.exit(1)
  }
  return { url, serviceKey }
}

export function criarAdmin() {
  const { url, serviceKey } = exigirUrlEServiceKey()
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function resolverClienteId(admin, { envId, slugPadrao = 'raffiner' } = {}) {
  const fromEnv = (envId || process.env.UPLOAD_CLIENTE_ID || '').trim()
  if (fromEnv) return fromEnv

  const { data, error } = await admin
    .from('clientes')
    .select('id')
    .eq('slug', slugPadrao)
    .maybeSingle()

  if (error) throw error
  if (!data?.id) {
    throw new Error(
      `Cliente com slug "${slugPadrao}" não encontrado. Rode o seed ou defina UPLOAD_CLIENTE_ID.`,
    )
  }
  return data.id
}

/** Cria bucket privado (leitura via signed URL + RLS), se ainda não existir. */
export async function garantirBucketPrivado(
  admin,
  { id, fileSizeLimit, mimeTypes = MIME_TYPES_LISTA },
) {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets()
  if (listErr) throw listErr

  const existe = (buckets ?? []).some((b) => b.id === id || b.name === id)
  if (existe) return

  const { error } = await admin.storage.createBucket(id, {
    public: false,
    fileSizeLimit,
    allowedMimeTypes: mimeTypes,
  })
  if (error && !/already exists/i.test(error.message)) throw error
}

/** @deprecated use garantirBucketPrivado */
export async function garantirBucketPublico(admin, opts) {
  return garantirBucketPrivado(admin, opts)
}

export async function garantirBucketLogos(admin) {
  return garantirBucketPrivado(admin, {
    id: BUCKET_LOGOS,
    fileSizeLimit: TAMANHO_MAX_LOGO,
  })
}

export async function garantirBucketItens(admin) {
  return garantirBucketPrivado(admin, {
    id: BUCKET_ITENS,
    fileSizeLimit: TAMANHO_MAX_ITEM,
  })
}
