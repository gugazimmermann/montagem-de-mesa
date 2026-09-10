#!/usr/bin/env node
/**
 * Aplica a migration SQL no Postgres do Supabase.
 * Necessário no .env: DATABASE_URL (connection string do Database settings).
 *
 * Dica: se a senha tiver caracteres especiais (& ? %), URL-encode:
 *   & → %26   % → %25   ? → %3F
 */
import pg from 'pg'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
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
    if (process.env[chave] === undefined) process.env[chave] = valor
  }
}

carregarEnv(join(root, '.env'))

const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!dbUrl || !dbUrl.startsWith('postgresql://')) {
  console.error(
    'Defina DATABASE_URL no .env (Supabase → Project Settings → Database → URI).',
  )
  console.error(
    'Alternativa: cole o SQL de supabase/migrations/ no SQL Editor do Dashboard.',
  )
  process.exit(1)
}

const migrationArg = process.argv[2]
const migrationPath = migrationArg
  ? join(root, migrationArg)
  : join(root, 'supabase/migrations/20260729120000_auth_catalogo.sql')

if (!existsSync(migrationPath)) {
  console.error('Migration não encontrada:', migrationPath)
  process.exit(1)
}

const sql = readFileSync(migrationPath, 'utf8')

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(sql)
  console.log('Migration aplicada:', relative(root, migrationPath))
} catch (err) {
  console.error('Migration falhou:', err.message)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
