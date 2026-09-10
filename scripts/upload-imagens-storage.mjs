#!/usr/bin/env node
/**
 * Upload de public/imgs → Storage bucket `itens` sob {cliente_id}/...
 * Atualiza catalogo.json e a tabela itens com as URLs públicas.
 *
 * Necessário no .env: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Opcional: UPLOAD_CLIENTE_ID (default raffiner)
 */
import { createClient } from '@supabase/supabase-js'
import {
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  statSync,
} from 'node:fs'
import { dirname, join, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const BUCKET = 'itens'
const EXTS = new Set(['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'])
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

if (!url || !serviceKey) {
  console.error(
    'Defina no .env: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
  )
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function listarImagens(dir) {
  const out = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    const st = statSync(caminho)
    if (st.isDirectory()) {
      out.push(...listarImagens(caminho))
      continue
    }
    if (EXTS.has(extname(nome).toLowerCase())) out.push(caminho)
  }
  return out
}

/** Storage rejeita acentos/diacríticos na object key. */
function sanitizarSegmento(segmento) {
  return segmento.normalize('NFD').replace(/\p{M}/gu, '')
}

function sanitizarPathStorage(relPath) {
  return relPath
    .split('/')
    .map((seg) => sanitizarSegmento(seg))
    .join('/')
}

function caminhoLocalParaStorage(caminhoAbs) {
  const rel = relative(join(root, 'public', 'imgs'), caminhoAbs)
    .split('\\')
    .join('/')
  return `${clienteId}/${sanitizarPathStorage(rel)}`
}

function urlPublica(pathStorage) {
  const { data } = admin.storage.from(BUCKET).getPublicUrl(pathStorage)
  return data.publicUrl
}

/** Converte /imgs/Pasta/Arquivo.webp (com ou sem encode) → path Storage */
function imagemLocalParaStoragePath(imagem) {
  if (!imagem) return null
  try {
    const decoded = decodeURIComponent(imagem)
    const m = decoded.match(/^\/?imgs\/(.+)$/i)
    if (!m) return null
    return `${clienteId}/${sanitizarPathStorage(m[1])}`
  } catch {
    return null
  }
}

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
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: Object.values(MIME),
  })
  if (error) throw error
  console.log(`Bucket "${BUCKET}" criado`)
}

async function uploadArquivos(arquivos) {
  let ok = 0
  let falhas = 0

  for (const arquivo of arquivos) {
    const pathStorage = caminhoLocalParaStorage(arquivo)
    const ext = extname(arquivo).toLowerCase()
    const body = readFileSync(arquivo)
    const { error } = await admin.storage.from(BUCKET).upload(pathStorage, body, {
      contentType: MIME[ext] || 'application/octet-stream',
      upsert: true,
    })
    if (error) {
      console.error('Falha upload:', pathStorage, error.message)
      falhas += 1
      continue
    }
    ok += 1
    if (ok % 25 === 0) console.log(`  ${ok}/${arquivos.length} enviados...`)
  }

  console.log(`Upload: ${ok} ok, ${falhas} falhas`)
  if (falhas > 0) throw new Error(`${falhas} upload(s) falharam`)
}

function atualizarCatalogoJson() {
  const catalogoPath = join(root, 'src/dados/catalogo.json')
  const catalogo = JSON.parse(readFileSync(catalogoPath, 'utf8'))
  let alterados = 0

  for (const item of catalogo.itens) {
    const pathStorage = imagemLocalParaStoragePath(item.imagem)
    if (!pathStorage) continue
    const nova = urlPublica(pathStorage)
    if (item.imagem !== nova) {
      item.imagem = nova
      alterados += 1
    }
  }

  writeFileSync(catalogoPath, `${JSON.stringify(catalogo, null, 2)}\n`, 'utf8')
  console.log(`catalogo.json: ${alterados} imagens atualizadas`)
  return catalogo
}

async function atualizarItensNoBanco(catalogo) {
  let ok = 0
  let falhas = 0

  for (const item of catalogo.itens) {
    if (!item.imagem?.includes('/storage/v1/object/public/')) continue
    const { error } = await admin
      .from('itens')
      .update({ imagem: item.imagem })
      .eq('cliente_id', clienteId)
      .eq('id', item.id)
    if (error) {
      console.error('Falha update item:', item.id, error.message)
      falhas += 1
      continue
    }
    ok += 1
  }

  console.log(`Tabela itens: ${ok} atualizados, ${falhas} falhas`)
  if (falhas > 0) throw new Error(`${falhas} update(s) no banco falharam`)
}

try {
  const imgsDir = join(root, 'public', 'imgs')
  if (!existsSync(imgsDir)) {
    console.error('Pasta public/imgs não encontrada')
    process.exit(1)
  }

  const arquivos = listarImagens(imgsDir).sort()
  console.log(`Cliente: ${clienteId}`)
  console.log(`Imagens locais: ${arquivos.length}`)

  await garantirBucket()
  await uploadArquivos(arquivos)
  const catalogo = atualizarCatalogoJson()
  await atualizarItensNoBanco(catalogo)

  console.log('Concluído.')
  console.log(
    `Exemplo: ${urlPublica(caminhoLocalParaStorage(arquivos[0]))}`,
  )
} catch (err) {
  console.error('Upload falhou:', err)
  process.exit(1)
}
