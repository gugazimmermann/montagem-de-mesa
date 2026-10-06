/** Converte imagem local para WebP dentro do limite do bucket `itens`. */
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { TAMANHO_MAX_ITEM } from './imagem-mime.mjs'

const SCRIPT_WEBP = join(
  dirname(fileURLToPath(import.meta.url)),
  'para-webp.py',
)

/**
 * @param {string} arquivo caminho local
 * @param {number} [limiteBytes]
 * @returns {{ body: Buffer, ext: '.webp' }}
 */
export function prepararImagem(arquivo, limiteBytes = TAMANHO_MAX_ITEM) {
  const ext = extname(arquivo).toLowerCase()
  if (ext === '.webp' && statSync(arquivo).size <= limiteBytes) {
    return { body: readFileSync(arquivo), ext: '.webp' }
  }

  const destino = join(tmpdir(), `item-${randomUUID()}.webp`)
  const tentativas = [
    ['1600', '80'],
    ['1200', '70'],
    ['800', '60'],
  ]
  let ultimoErro = 'arquivo passou de 5 MB'
  try {
    for (const [lado, qualidade] of tentativas) {
      execFileSync('python3', [SCRIPT_WEBP, arquivo, destino, lado, qualidade], {
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      if (statSync(destino).size <= limiteBytes) {
        return { body: readFileSync(destino), ext: '.webp' }
      }
      ultimoErro = `ainda ${statSync(destino).size} bytes após ${lado}px`
    }
  } finally {
    if (existsSync(destino)) unlinkSync(destino)
  }
  throw new Error(ultimoErro)
}
