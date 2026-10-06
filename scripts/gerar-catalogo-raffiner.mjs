#!/usr/bin/env node
/** Reescreve src/dados/catalogo.json a partir de imagens/itens/raffiner. */
import { join } from 'node:path'
import { carregarEnvRaiz } from './lib/carregar-env.mjs'
import { escreverCatalogo } from './lib/catalogo-raffiner.mjs'

const root = carregarEnvRaiz(import.meta.url)
const { catalogo, avisos } = escreverCatalogo(
  join(root, 'imagens/itens/raffiner'),
  join(root, 'src/dados/catalogo.json'),
)

const porCategoria = new Map()
for (const item of catalogo.itens) {
  porCategoria.set(item.categoria, (porCategoria.get(item.categoria) ?? 0) + 1)
}

console.log(`Catálogo: ${catalogo.categorias.length} categorias, ${catalogo.itens.length} itens`)
for (const c of catalogo.categorias) {
  console.log(`  ${c.rotulo}: ${porCategoria.get(c.id) ?? 0}`)
}
for (const aviso of avisos) console.warn(aviso)
