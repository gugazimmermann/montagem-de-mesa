import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export function carregarEnv(caminho) {
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

/** Carrega `.env` na raiz do projeto (scripts/* → ../.env). */
export function carregarEnvRaiz(importMetaUrl) {
  const root = join(dirname(fileURLToPath(importMetaUrl)), '..')
  carregarEnv(join(root, '.env'))
  return root
}
