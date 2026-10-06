#!/usr/bin/env node
/**
 * Upsert itens Raffiner + upload WebP (mesa + catalogo) para um cliente fixo.
 * Não recria o cliente nem apaga categorias.
 *
 * Uso: node scripts/seed-itens-raffiner.mjs [clienteId]
 */
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  CATEGORIAS,
  chaveItem,
  gerarCatalogo,
  escreverCatalogo,
} from './lib/catalogo-raffiner.mjs'
import { carregarEnvRaiz } from './lib/carregar-env.mjs'
import { BUCKET_ITENS, MIME_POR_EXT } from './lib/imagem-mime.mjs'
import { prepararImagem } from './lib/preparar-imagem.mjs'
import {
  criarAdmin,
  exigirUrlEServiceKey,
  garantirBucketItens,
} from './lib/supabase-admin.mjs'

const CLIENTE_PADRAO = 'e748c226-cc17-4738-a115-eea3cde5d889'

const root = carregarEnvRaiz(import.meta.url)
exigirUrlEServiceKey()
const admin = criarAdmin()
const alvo = (process.argv[2] || CLIENTE_PADRAO).trim()
const imgsRoot = join(root, 'imagens/itens/raffiner')
const catalogoPath = join(root, 'src/dados/catalogo.json')

async function resolverCliente(idOuAuth) {
  const { data: porId, error: errId } = await admin
    .from('clientes')
    .select('id, slug, nome')
    .eq('id', idOuAuth)
    .maybeSingle()
  if (errId) throw errId
  if (porId) return porId

  const { data: porAuth, error: errAuth } = await admin
    .from('clientes')
    .select('id, slug, nome')
    .eq('auth_user_id', idOuAuth)
    .maybeSingle()
  if (errAuth) throw errAuth
  if (porAuth) return porAuth

  throw new Error(`Cliente não encontrado: ${idOuAuth}`)
}

async function subirArquivo(pathStorage, arquivoLocal) {
  const preparado = prepararImagem(arquivoLocal)
  const { error } = await admin.storage.from(BUCKET_ITENS).upload(
    pathStorage,
    preparado.body,
    {
      contentType: MIME_POR_EXT[preparado.ext] || 'image/webp',
      upsert: true,
    },
  )
  if (error) throw error
  return pathStorage
}

async function main() {
  if (!existsSync(imgsRoot)) {
    throw new Error(`Pasta não encontrada: ${imgsRoot}`)
  }

  const cliente = await resolverCliente(alvo)
  console.log(`Cliente: ${cliente.nome} (${cliente.slug}) ${cliente.id}`)

  const { catalogo, avisos, itensComArquivos } = gerarCatalogo(imgsRoot)
  for (const aviso of avisos) console.warn(aviso)
  escreverCatalogo(imgsRoot, catalogoPath)
  console.log(
    `Catálogo local: ${catalogo.categorias.length} categorias, ${catalogo.itens.length} itens`,
  )

  const { data: catsDb, error: catsErr } = await admin
    .from('categorias')
    .select('id, codigo')
    .eq('cliente_id', cliente.id)
    .is('deleted_at', null)
  if (catsErr) throw catsErr

  const codigoParaId = new Map(
    (catsDb ?? []).filter((c) => c.codigo).map((c) => [c.codigo, c.id]),
  )
  for (const cat of CATEGORIAS) {
    if (!codigoParaId.has(cat.id)) {
      throw new Error(
        `Categoria ${cat.id} ausente no banco. Rode seed-categorias-raffiner.mjs.`,
      )
    }
  }

  const { data: itensDb, error: itensErr } = await admin
    .from('itens')
    .select('id, categoria_id, nome, imagem, imagem_catalogo')
    .eq('cliente_id', cliente.id)
    .is('deleted_at', null)
  if (itensErr) throw itensErr

  const existentes = new Map()
  for (const row of itensDb ?? []) {
    const codigo = [...codigoParaId.entries()].find(
      ([, id]) => id === row.categoria_id,
    )?.[0]
    if (!codigo) continue
    existentes.set(`${codigo}|${chaveItem(row.nome)}`, row)
  }

  await garantirBucketItens(admin)

  let inseridos = 0
  let atualizados = 0
  let uploadsOk = 0
  let uploadsFalha = 0

  for (const [ordem, item] of itensComArquivos.entries()) {
    const categoriaId = codigoParaId.get(item.categoria)
    const chave = `${item.categoria}|${chaveItem(item.nome)}`
    const atual = existentes.get(chave)

    const payloadBase = {
      nome: item.nome,
      cores: item.cores,
      largura: item.largura,
      comprimento: item.comprimento,
      ordem,
      deleted_at: null,
    }

    let itemId
    if (atual) {
      itemId = atual.id
      const { error } = await admin
        .from('itens')
        .update({
          ...payloadBase,
          categoria_id: categoriaId,
        })
        .eq('cliente_id', cliente.id)
        .eq('id', itemId)
      if (error) throw error
      atualizados += 1
    } else {
      itemId = randomUUID()
      const { error } = await admin.from('itens').insert({
        cliente_id: cliente.id,
        id: itemId,
        categoria_id: categoriaId,
        ...payloadBase,
        imagem: null,
        imagem_catalogo: null,
      })
      if (error) throw error
      inseridos += 1
      existentes.set(chave, { id: itemId, categoria_id: categoriaId, nome: item.nome })
    }

    const updates = {}
    try {
      if (item.arquivoMesa) {
        updates.imagem = await subirArquivo(
          `${cliente.id}/${categoriaId}/${itemId}.webp`,
          item.arquivoMesa,
        )
        uploadsOk += 1
      }
      if (item.arquivoCatalogo) {
        updates.imagem_catalogo = await subirArquivo(
          `${cliente.id}/${categoriaId}/${itemId}-catalogo.webp`,
          item.arquivoCatalogo,
        )
        uploadsOk += 1
      }
    } catch (err) {
      console.error(`Falha upload ${item.nome}:`, err.message)
      uploadsFalha += 1
      continue
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from('itens')
        .update(updates)
        .eq('cliente_id', cliente.id)
        .eq('id', itemId)
      if (error) throw error
    }

    if ((inseridos + atualizados) % 25 === 0) {
      console.log(`  ${inseridos + atualizados} itens processados...`)
    }
  }

  console.log(
    `Itens: ${inseridos} inseridos, ${atualizados} atualizados. Uploads: ${uploadsOk} ok, ${uploadsFalha} falhas.`,
  )
  if (uploadsFalha > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
