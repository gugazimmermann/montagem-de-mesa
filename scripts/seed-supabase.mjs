#!/usr/bin/env node
/**
 * Seed: Auth + cliente Raffiner (trial) + catálogo + upload para Storage.
 *
 * Necessário: VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * Opcional: SEED_EMAIL / SEED_PASSWORD / DATABASE_URL
 *
 * Defaults: financeiroraffiner@gmail.com / Raffiner / raffiner / trialing 14d
 * Fonte: imagens/logos e imagens/itens/raffiner (não apaga locais após upload).
 */
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { basename, extname, join, relative } from 'node:path'
import pg from 'pg'
import slugify from 'slugify'
import { carregarEnvRaiz } from './lib/carregar-env.mjs'
import {
  BUCKET_ITENS,
  BUCKET_LOGOS,
  EXTS_IMAGEM,
  MIME_POR_EXT,
} from './lib/imagem-mime.mjs'
import {
  criarAdmin,
  exigirUrlEServiceKey,
  garantirBucketItens,
  garantirBucketLogos,
} from './lib/supabase-admin.mjs'

const root = carregarEnvRaiz(import.meta.url)
const { url } = exigirUrlEServiceKey()
const databaseUrl = process.env.DATABASE_URL
const email = (process.env.SEED_EMAIL || 'financeiroraffiner@gmail.com').trim()
const password = process.env.SEED_PASSWORD || ''
const SLUG = 'raffiner'
const NOME = 'Raffiner'

/** Pasta em imagens/itens/raffiner → codigo da categoria no catálogo */
const PASTA_PARA_CODIGO = {
  Sousplat: 'sousplat',
  'Pratos Rasos': 'pratoRaso',
  'Pratos Fundos': 'pratoFundo',
  'Pratos de sobremesa': 'pratoSobremesa',
  'Porta Guardanapos': 'portaGuardanapo',
  Tacas: 'taca',
}

if (!password || password.length < 10) {
  console.error('Defina SEED_PASSWORD no .env (mín. 10 caracteres, igual ao app).')
  process.exit(1)
}

if (!url.startsWith('https://')) {
  console.error(
    'VITE_SUPABASE_URL deve ser a URL da API (https://xxxx.supabase.co), não a connection string postgresql://...',
  )
  process.exit(1)
}

const catalogoPath = join(root, 'src/dados/catalogo.json')
const catalogo = JSON.parse(readFileSync(catalogoPath, 'utf8'))
const admin = criarAdmin()

function semAcentos(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '')
}

function sanitizarSegmento(segmento) {
  return semAcentos(segmento)
}

async function buscarUsuarioPorEmail() {
  const alvo = email.toLowerCase()
  let page = 1
  const perPage = 200

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const encontrado = data.users.find((u) => u.email?.toLowerCase() === alvo)
    if (encontrado) return encontrado.id
    if (data.users.length < perPage) return null
    page += 1
  }
}

async function garantirUsuario() {
  const existenteId = await buscarUsuarioPorEmail()
  if (existenteId) {
    const { error } = await admin.auth.admin.updateUserById(existenteId, {
      password,
      email_confirm: true,
    })
    if (error) throw error
    console.log('Usuário Auth atualizado:', existenteId)
    return existenteId
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
  // Recria a linha: trigger impede mudar email/auth_user_id em UPDATE.
  const { data: existente, error: erroBusca } = await admin
    .from('clientes')
    .select('id')
    .eq('slug', SLUG)
    .maybeSingle()
  if (erroBusca) throw erroBusca

  if (existente?.id) {
    const { error: delErr } = await admin
      .from('clientes')
      .delete()
      .eq('id', existente.id)
    if (delErr) throw delErr
  }

  const clienteId = randomUUID()
  const logoUrl = `${url.replace(/\/$/, '')}/storage/v1/object/public/logos/${clienteId}.webp`

  const { error } = await admin.from('clientes').insert({
    id: clienteId,
    auth_user_id: authUserId,
    slug: slugify(SLUG, { lower: true, strict: true }),
    email,
    nome: NOME,
    logo: logoUrl,
    subscription_status: 'trialing',
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    current_period_end: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  })
  if (error) throw error

  console.log('Cliente raffiner (trial) criado:', clienteId)
  return clienteId
}

function montarCatalogo(clienteId) {
  const mapaCategorias = new Map()
  for (const c of catalogo.categorias) {
    mapaCategorias.set(c.id, randomUUID())
  }

  const categorias = catalogo.categorias.map((c, ordem) => ({
    cliente_id: clienteId,
    id: mapaCategorias.get(c.id),
    codigo: c.id,
    rotulo: c.rotulo,
    descricao: c.descricao ?? '',
    ordem,
  }))

  const itens = catalogo.itens.map((item, ordem) => {
    const categoriaId = mapaCategorias.get(item.categoria)
    if (!categoriaId) {
      throw new Error(`Categoria desconhecida no catálogo: ${item.categoria}`)
    }
    return {
      cliente_id: clienteId,
      id: randomUUID(),
      categoria_id: categoriaId,
      nome: item.nome,
      // URLs antigas de outro clienteId falham no CHECK; uploadItens preenche depois.
      imagem: null,
      cores: item.cores,
      largura: item.largura ?? null,
      comprimento: item.comprimento ?? null,
      padrao: item.padrao ?? null,
      descricao: item.descricao ?? null,
      ordem,
    }
  })

  return { categorias, itens }
}

async function seedCatalogoViaPg(clienteId, categorias, itens) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query('begin')
    await client.query('delete from public.itens where cliente_id = $1', [
      clienteId,
    ])
    await client.query('delete from public.categorias where cliente_id = $1', [
      clienteId,
    ])

    for (const c of categorias) {
      await client.query(
        `insert into public.categorias
          (cliente_id, id, codigo, rotulo, descricao, ordem)
         values ($1, $2, $3, $4, $5, $6)`,
        [c.cliente_id, c.id, c.codigo, c.rotulo, c.descricao, c.ordem],
      )
    }

    for (const item of itens) {
      await client.query(
        `insert into public.itens
          (cliente_id, id, categoria_id, nome, imagem, cores, largura, comprimento, padrao, descricao, ordem)
         values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)`,
        [
          item.cliente_id,
          item.id,
          item.categoria_id,
          item.nome,
          item.imagem,
          JSON.stringify(item.cores),
          item.largura,
          item.comprimento,
          item.padrao,
          item.descricao,
          item.ordem,
        ],
      )
    }

    await client.query('commit')
    console.log('Catálogo gravado em transação (DATABASE_URL).')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    await client.end()
  }
}

async function seedCatalogoViaApi(clienteId, categorias, itens) {
  await admin.from('itens').delete().eq('cliente_id', clienteId)
  await admin.from('categorias').delete().eq('cliente_id', clienteId)

  const { error: catErr } = await admin.from('categorias').insert(categorias)
  if (catErr) throw catErr

  const lote = 50
  for (let i = 0; i < itens.length; i += lote) {
    const fatia = itens.slice(i, i + lote)
    const { error } = await admin.from('itens').insert(fatia)
    if (error) throw error
  }
  console.log(
    'Catálogo gravado via API (defina DATABASE_URL para transação atômica).',
  )
}

async function seedCatalogo(clienteId) {
  const { categorias, itens } = montarCatalogo(clienteId)

  if (databaseUrl) {
    await seedCatalogoViaPg(clienteId, categorias, itens)
  } else {
    await seedCatalogoViaApi(clienteId, categorias, itens)
  }

  console.log(`Catálogo: ${categorias.length} categorias, ${itens.length} itens`)
}

function listarImagens(dir) {
  const out = []
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    const st = statSync(caminho)
    if (st.isDirectory()) {
      out.push(...listarImagens(caminho))
      continue
    }
    if (EXTS_IMAGEM.has(extname(nome).toLowerCase())) out.push(caminho)
  }
  return out
}

async function uploadLogo(clienteId) {
  const logoSrc = join(root, 'imagens/logos/raffiner.webp')
  if (!existsSync(logoSrc)) {
    throw new Error(`Logo não encontrado: ${logoSrc}`)
  }

  await garantirBucketLogos(admin)
  const objectKey = `${clienteId}.webp`
  const body = readFileSync(logoSrc)
  const { error: upErr } = await admin.storage.from(BUCKET_LOGOS).upload(objectKey, body, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (upErr) throw upErr

  const { data: pub } = admin.storage.from(BUCKET_LOGOS).getPublicUrl(objectKey)
  const { error: updErr } = await admin
    .from('clientes')
    .update({ logo: pub.publicUrl, updated_at: new Date().toISOString() })
    .eq('id', clienteId)
  if (updErr) throw updErr

  console.log('Logo enviada:', pub.publicUrl)
  return pub.publicUrl
}

async function uploadItens(clienteId) {
  const imgsRoot = join(root, 'imagens/itens/raffiner')
  if (!existsSync(imgsRoot)) {
    throw new Error(`Pasta de imagens não encontrada: ${imgsRoot}`)
  }

  await garantirBucketItens(admin)

  const { data: catsDb, error: catsErr } = await admin
    .from('categorias')
    .select('id, codigo')
    .eq('cliente_id', clienteId)
  if (catsErr) throw catsErr

  const codigoParaId = new Map(
    (catsDb ?? []).filter((c) => c.codigo).map((c) => [c.codigo, c.id]),
  )

  /** chave: codigo|nomeSemAcento → url pública */
  const urlPorItem = new Map()
  const arquivos = listarImagens(imgsRoot).sort()
  let ok = 0
  let falhas = 0
  let semPasta = 0

  for (const arquivo of arquivos) {
    const rel = relative(imgsRoot, arquivo).split('\\').join('/')
    const pasta = rel.split('/')[0]
    const codigo = PASTA_PARA_CODIGO[pasta]
    if (!codigo) {
      console.warn('Pasta de categoria desconhecida (ignorada):', pasta)
      semPasta += 1
      continue
    }

    const nomeArquivo = basename(arquivo, extname(arquivo))
    const pathStorage = `${clienteId}/${codigo}/${sanitizarSegmento(basename(arquivo))}`
    const ext = extname(arquivo).toLowerCase()
    const body = readFileSync(arquivo)

    const { error } = await admin.storage.from(BUCKET_ITENS).upload(pathStorage, body, {
      contentType: MIME_POR_EXT[ext] || 'application/octet-stream',
      upsert: true,
    })
    if (error) {
      console.error('Falha upload:', pathStorage, error.message)
      falhas += 1
      continue
    }

    const { data: pub } = admin.storage.from(BUCKET_ITENS).getPublicUrl(pathStorage)
    urlPorItem.set(`${codigo}|${semAcentos(nomeArquivo).toLowerCase()}`, pub.publicUrl)
    ok += 1
    if (ok % 25 === 0) console.log(`  ${ok}/${arquivos.length} enviados...`)
  }

  console.log(
    `Upload itens: ${ok} ok, ${falhas} falhas, ${semPasta} pasta(s) ignorada(s)`,
  )
  if (falhas > 0) throw new Error(`${falhas} upload(s) falharam`)

  let atualizadosDb = 0
  let semMatch = 0

  for (const item of catalogo.itens) {
    const chave = `${item.categoria}|${semAcentos(item.nome).toLowerCase()}`
    const novaUrl = urlPorItem.get(chave)
    if (!novaUrl) {
      console.warn('Sem imagem para:', item.categoria, item.nome)
      semMatch += 1
      continue
    }

    const categoriaId = codigoParaId.get(item.categoria)
    if (!categoriaId) {
      console.error('Categoria não encontrada no banco:', item.categoria)
      continue
    }

    const { data, error } = await admin
      .from('itens')
      .update({ imagem: novaUrl })
      .eq('cliente_id', clienteId)
      .eq('categoria_id', categoriaId)
      .eq('nome', item.nome)
      .select('id')

    if (error) throw error
    if (!data?.length) {
      console.warn('Item sem match no banco:', item.categoria, item.nome)
      continue
    }
    atualizadosDb += 1
  }

  console.log(`URLs no banco: ${atualizadosDb}; sem imagem: ${semMatch}`)
}

try {
  const authUserId = await garantirUsuario()
  const clienteId = await upsertCliente(authUserId)
  await seedCatalogo(clienteId)
  await uploadLogo(clienteId)
  await uploadItens(clienteId)

  console.log('Seed concluído.')
  console.log(`Login: ${email}`)
  console.log(`Cliente ID: ${clienteId}`)
  console.log(`Montagem pública: /${SLUG}`)
} catch (err) {
  console.error('Seed falhou:', err)
  process.exit(1)
}
