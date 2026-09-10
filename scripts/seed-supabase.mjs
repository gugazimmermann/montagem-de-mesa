#!/usr/bin/env node
/**
 * Seed one-shot: cria usuário Auth + cliente raffiner + catálogo.
 *
 * Lê automaticamente o `.env` na raiz do projeto.
 * Necessário: VITE_SUPABASE_URL (https://....supabase.co) e SUPABASE_SERVICE_ROLE_KEY.
 *
 * Opcional: SEED_EMAIL / SEED_PASSWORD
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

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
    if (process.env[chave] === undefined) {
      process.env[chave] = valor
    }
  }
}

carregarEnv(join(root, '.env'))

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SEED_EMAIL || 'admin@raffiner.com'
const password = process.env.SEED_PASSWORD || 'admin123'

if (!url || !serviceKey) {
  console.error(
    'Defina no .env: VITE_SUPABASE_URL (https://SEU_REF.supabase.co) e SUPABASE_SERVICE_ROLE_KEY.',
  )
  console.error(
    'Ambos ficam em Supabase → Project Settings → API (não use a connection string do Postgres).',
  )
  process.exit(1)
}

if (!url.startsWith('https://')) {
  console.error(
    'VITE_SUPABASE_URL deve ser a URL da API (https://xxxx.supabase.co), não a connection string postgresql://...',
  )
  process.exit(1)
}

const catalogo = JSON.parse(
  readFileSync(join(root, 'src/dados/catalogo.json'), 'utf8'),
)

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CLIENTE_ID = 'raffiner'

async function garantirUsuario() {
  const { data: listado, error: listErr } = await admin.auth.admin.listUsers({
    perPage: 200,
  })
  if (listErr) throw listErr

  const existente = listado.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (existente) {
    console.log('Usuário Auth já existe:', existente.id)
    return existente.id
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  console.log('Usuário Auth criado:', data.user.id)
  return data.user.id
}

async function upsertCliente(authUserId) {
  const { error } = await admin.from('clientes').upsert(
    {
      id: CLIENTE_ID,
      auth_user_id: authUserId,
      slug: 'raffiner',
      email,
      nome: 'Raffiner',
      logo: `${url.replace(/\/$/, '')}/storage/v1/object/public/logos/${CLIENTE_ID}.webp`,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
  console.log('Cliente raffiner upserted')
}

async function seedCatalogo() {
  await admin.from('itens').delete().eq('cliente_id', CLIENTE_ID)
  await admin.from('categorias').delete().eq('cliente_id', CLIENTE_ID)

  const categorias = catalogo.categorias.map((c, ordem) => ({
    cliente_id: CLIENTE_ID,
    id: c.id,
    rotulo: c.rotulo,
    descricao: c.descricao ?? '',
    ordem,
  }))

  const { error: catErr } = await admin.from('categorias').insert(categorias)
  if (catErr) throw catErr

  const itens = catalogo.itens.map((item, ordem) => ({
    cliente_id: CLIENTE_ID,
    id: item.id,
    categoria_id: item.categoria,
    nome: item.nome,
    imagem: item.imagem ?? null,
    cores: item.cores,
    largura: item.largura ?? null,
    comprimento: item.comprimento ?? null,
    padrao: item.padrao ?? null,
    descricao: item.descricao ?? null,
    ordem,
  }))

  const lote = 50
  for (let i = 0; i < itens.length; i += lote) {
    const fatia = itens.slice(i, i + lote)
    const { error } = await admin.from('itens').insert(fatia)
    if (error) throw error
  }

  console.log(
    `Catálogo: ${categorias.length} categorias, ${itens.length} itens`,
  )
}

try {
  const authUserId = await garantirUsuario()
  await upsertCliente(authUserId)
  await seedCatalogo()
  console.log('Seed concluído.')
  console.log(`Login: ${email} / ${password}`)
} catch (err) {
  console.error('Seed falhou:', err)
  process.exit(1)
}
