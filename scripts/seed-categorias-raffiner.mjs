#!/usr/bin/env node
/**
 * Upsert das categorias Raffiner (pastas de imagens/itens/raffiner) para um cliente.
 * Não apaga categorias/itens existentes; não sobe imagens.
 *
 * Uso: node scripts/seed-categorias-raffiner.mjs [clienteId]
 * Default clienteId: e748c226-cc17-4738-a115-eea3cde5d889
 */
import { randomUUID } from 'node:crypto'
import { CATEGORIAS } from './lib/catalogo-raffiner.mjs'
import { carregarEnvRaiz } from './lib/carregar-env.mjs'
import { criarAdmin, exigirUrlEServiceKey } from './lib/supabase-admin.mjs'

const CLIENTE_PADRAO = 'e748c226-cc17-4738-a115-eea3cde5d889'

carregarEnvRaiz(import.meta.url)
exigirUrlEServiceKey()
const admin = criarAdmin()

const alvo = (process.argv[2] || CLIENTE_PADRAO).trim()

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

  throw new Error(
    `Cliente não encontrado por id nem auth_user_id: ${idOuAuth}`,
  )
}

async function main() {
  const cliente = await resolverCliente(alvo)
  console.log(`Cliente: ${cliente.nome} (${cliente.slug}) ${cliente.id}`)

  const { data: existentes, error: listErr } = await admin
    .from('categorias')
    .select('id, codigo, deleted_at')
    .eq('cliente_id', cliente.id)
  if (listErr) throw listErr

  const porCodigo = new Map(
    (existentes ?? []).filter((c) => c.codigo).map((c) => [c.codigo, c]),
  )

  let inseridas = 0
  let atualizadas = 0

  for (const [ordem, cat] of CATEGORIAS.entries()) {
    const atual = porCodigo.get(cat.id)
    if (atual) {
      const { error } = await admin
        .from('categorias')
        .update({
          rotulo: cat.rotulo,
          descricao: cat.descricao ?? '',
          ordem,
          deleted_at: null,
        })
        .eq('cliente_id', cliente.id)
        .eq('id', atual.id)
      if (error) throw error
      atualizadas += 1
      console.log(`  atualizada: ${cat.id} → ${cat.rotulo}`)
    } else {
      const { error } = await admin.from('categorias').insert({
        cliente_id: cliente.id,
        id: randomUUID(),
        codigo: cat.id,
        rotulo: cat.rotulo,
        descricao: cat.descricao ?? '',
        ordem,
      })
      if (error) throw error
      inseridas += 1
      console.log(`  inserida: ${cat.id} → ${cat.rotulo}`)
    }
  }

  console.log(
    `Pronto: ${inseridas} inseridas, ${atualizadas} atualizadas (${CATEGORIAS.length} categorias).`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
