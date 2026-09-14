#!/usr/bin/env node
/**
 * Aplica migrations SQL no Postgres do Supabase.
 * Necessário no .env: DATABASE_URL (connection string do Database settings).
 *
 * Sem argumentos: aplica todos os .sql em supabase/migrations/ (ordem lexicográfica).
 * Com argumento: aplica só o arquivo informado (caminho relativo à raiz do repo).
 *
 * Dica: se a senha tiver caracteres especiais (& ? %), URL-encode:
 *   & → %26   % → %25   ? → %3F
 *
 * As migrations deste app droparam só clientes/categorias/itens/montagens_enviadas (+ objetos ligados).
 * Não resetam o Database e não tocam em tabelas de outros apps (ex.: leads).
 */
import pg from 'pg'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { carregarEnvRaiz } from './lib/carregar-env.mjs'

const root = carregarEnvRaiz(import.meta.url)
const migrationsDir = join(root, 'supabase/migrations')

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

function listarMigrations() {
  if (!existsSync(migrationsDir)) {
    console.error('Pasta de migrations não encontrada:', migrationsDir)
    process.exit(1)
  }
  return readdirSync(migrationsDir)
    .filter((nome) => nome.endsWith('.sql'))
    .sort()
    .map((nome) => join(migrationsDir, nome))
}

const migrationArg = process.argv[2]
const arquivos = migrationArg
  ? [join(root, migrationArg)]
  : listarMigrations()

if (arquivos.length === 0) {
  console.error('Nenhuma migration .sql encontrada em supabase/migrations/')
  process.exit(1)
}

for (const migrationPath of arquivos) {
  if (!existsSync(migrationPath)) {
    console.error('Migration não encontrada:', migrationPath)
    process.exit(1)
  }
}

const client = new pg.Client({
  connectionString: dbUrl,
  // Prefer CA válida: defina DATABASE_SSL_REJECT_UNAUTHORIZED=true (padrão) com
  // certificado confiável. Só use false em ambientes locais/legacy.
  ssl: {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
  },
})

try {
  await client.connect()
  for (const migrationPath of arquivos) {
    const sql = readFileSync(migrationPath, 'utf8')
    await client.query(sql)
    console.log('Migration aplicada:', relative(root, migrationPath))
  }
  console.log(`Concluído: ${arquivos.length} arquivo(s).`)
} catch (err) {
  console.error('Migration falhou:', err.message)
  process.exit(1)
} finally {
  await client.end().catch(() => {})
}
