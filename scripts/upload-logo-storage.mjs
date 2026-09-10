#!/usr/bin/env node
/**
 * Upload do logo local → Storage bucket `logos` como {cliente_id}.webp
 * Atualiza clientes.logo.
 *
 * Necessário no .env: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Opcional: UPLOAD_CLIENTE_ID (default raffiner)
 *           UPLOAD_LOGO_SRC (default public/logo/logo_h.webp)
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const BUCKET = 'logos'
const MIME = {
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

function carregarEnv(caminho) {
  if (!existsSync(caminho)) return
  const texto = readFileSync(caminho, 'utf8')
  for (const linha of texto.split('\n')) {
    const trim = linha.trim()
    if (!trim || trim.startsWith('#')) continue
    const eq = trim.indexOf('=')
    if (eq <= 0) continue
    const chave = trim.slice(0, eq).trim()
    let valor = trim.slice(eq + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    if (process.env[chave] === undefined) process.env[chave] = valor
  }
}

carregarEnv(join(root, '.env'))

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const clienteId = process.env.UPLOAD_CLIENTE_ID || 'raffiner'
const logoSrc =
  process.env.UPLOAD_LOGO_SRC || join(root, 'public/logo/logo_h.webp')

if (!url || !serviceKey) {
  console.error(
    'Defina no .env: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function garantirBucket() {
  const { data: buckets, error: listErr } = await admin.storage.listBuckets()
  if (listErr) throw listErr

  const existe = buckets?.some((b) => b.id === BUCKET || b.name === BUCKET)
  if (existe) {
    console.log(`Bucket "${BUCKET}" já existe`)
    return
  }

  const { error } = await admin.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 2 * 1024 * 1024,
    allowedMimeTypes: Object.values(MIME),
  })
  if (error) throw error
  console.log(`Bucket "${BUCKET}" criado`)
}

try {
  if (!existsSync(logoSrc)) {
    console.error('Arquivo de logo não encontrado:', logoSrc)
    process.exit(1)
  }

  const ext = extname(logoSrc).toLowerCase() || '.webp'
  const objectKey = `${clienteId}${ext === '.jpeg' ? '.jpg' : ext}`
  const body = readFileSync(logoSrc)

  await garantirBucket()

  const { error: upErr } = await admin.storage.from(BUCKET).upload(objectKey, body, {
    contentType: MIME[ext] || 'image/webp',
    upsert: true,
  })
  if (upErr) throw upErr

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(objectKey)
  const logoUrl = pub.publicUrl

  const { error: dbErr } = await admin
    .from('clientes')
    .update({ logo: logoUrl })
    .eq('id', clienteId)
  if (dbErr) throw dbErr

  console.log('Upload ok:', objectKey)
  console.log('Logo URL:', logoUrl)
} catch (err) {
  console.error('Upload do logo falhou:', err)
  process.exit(1)
}
