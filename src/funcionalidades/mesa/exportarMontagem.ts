import type { ConfiguracaoMesa, Categoria, ItemMesa, PadraoTecido } from '../../compartilhado/tipos'
import { inferirDimensoes, temDimensoes } from '../../compartilhado/utils/dimensoes'
import { obterItemPorId } from '../catalogo'
import { chaveCamada, ordenarCategoriasPorCamada } from './ordemCamadas'

const LARGURA = 800
const ALTURA = 600
const TIMEOUT_IMAGEM_MS = 8000

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    let finalizado = false

    const terminar = (valor: HTMLImageElement | null) => {
      if (finalizado) return
      finalizado = true
      window.clearTimeout(timer)
      resolve(valor)
    }

    const timer = window.setTimeout(() => terminar(null), TIMEOUT_IMAGEM_MS)
    img.crossOrigin = 'anonymous'
    img.onload = () => terminar(img)
    img.onerror = () => terminar(null)
    img.src = src
  })
}

function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  window.setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 1500)
}

function dimensoesParaExport(item: ItemMesa, codigo: string): { largura: number; comprimento: number } {
  if (temDimensoes(item)) {
    return { largura: item.largura, comprimento: item.comprimento }
  }
  return inferirDimensoes(item.nome, codigo)
}

/**
 * Exporta a montagem como PNG (canvas: madeira + camadas com imagem ou cor).
 * Retorna aviso opcional (ex.: fotos que falharam por CORS).
 */
export async function exportarMontagemPng(
  configuracao: ConfiguracaoMesa,
  categorias: Categoria[],
  itens: ItemMesa[],
  nomeArquivo = 'montagem-de-mesa.png',
): Promise<string | null> {
  const canvas = document.createElement('canvas')
  canvas.width = LARGURA
  canvas.height = ALTURA
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponível')

  const grad = ctx.createLinearGradient(0, 0, LARGURA, ALTURA)
  grad.addColorStop(0, '#5c3d2e')
  grad.addColorStop(0.4, '#3d2817')
  grad.addColorStop(1, '#2a1a0f')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, LARGURA, ALTURA)

  const ordem = ordenarCategoriasPorCamada(categorias)
  const cx = LARGURA / 2
  const cy = ALTURA / 2 + 20
  let imagensFalharam = 0

  for (const categoria of ordem) {
    const item = obterItemPorId(itens, configuracao[categoria.id] ?? null)
    if (!item) continue

    const codigo = chaveCamada(categoria)
    if (codigo === 'toalha') {
      desenharToalha(ctx, item)
      continue
    }

    const dims = dimensoesParaExport(item, codigo)
    const tamanho = tamanhoCamada(codigo, dims.largura, dims.comprimento)

    if (item.imagem) {
      const img = await carregarImagem(item.imagem)
      if (img) {
        const ratio = Math.min(tamanho / img.width, tamanho / img.height)
        const w = img.width * ratio
        const h = img.height * ratio
        const offsetY = codigo === 'taca' ? -tamanho * 0.35 : 0
        ctx.drawImage(img, cx - w / 2, cy - h / 2 + offsetY, w, h)
        continue
      }
      imagensFalharam += 1
    }

    // Fallback de cor (alinha ao preview quando não há imagem).
    ctx.fillStyle = item.cores.primaria
    ctx.beginPath()
    ctx.arc(cx, cy, tamanho / 2, 0, Math.PI * 2)
    ctx.fill()
  }

  let blob: Blob | null
  try {
    blob = await new Promise<Blob | null>((resolve, reject) => {
      try {
        canvas.toBlob((b) => resolve(b), 'image/png')
      } catch (e) {
        reject(e)
      }
    })
  } catch {
    throw new Error(
      'Não foi possível gerar a imagem (possível bloqueio CORS nas fotos).',
    )
  }
  if (!blob) throw new Error('Falha ao gerar imagem')

  baixarBlob(blob, nomeArquivo)

  if (imagensFalharam > 0) {
    return 'Imagem baixada, mas algumas fotos não carregaram (CORS ou rede).'
  }
  return null
}

function coresItem(item: ItemMesa): { p: string; s: string; d: string } {
  const p = item.cores.primaria
  return {
    p,
    s: item.cores.secundaria ?? p,
    d: item.cores.destaque ?? p,
  }
}

function desenharToalha(ctx: CanvasRenderingContext2D, item: ItemMesa): void {
  const x = 24
  const y = 24
  const w = LARGURA - 48
  const h = ALTURA - 48
  const r = 16
  const { p, s, d } = coresItem(item)
  const padrao = (item.padrao ?? 'solid') as PadraoTecido

  ctx.save()
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, r)
  ctx.clip()

  switch (padrao) {
    case 'stripes': {
      ctx.fillStyle = p
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = s
      const step = 28
      for (let i = 0; i < w; i += step) {
        ctx.fillRect(x + i + step / 2, y, step / 2, h)
      }
      break
    }
    case 'gingham': {
      ctx.fillStyle = p
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = s
      ctx.globalAlpha = 0.45
      const cell = 24
      for (let gx = 0; gx < w; gx += cell * 2) {
        ctx.fillRect(x + gx, y, cell, h)
      }
      for (let gy = 0; gy < h; gy += cell * 2) {
        ctx.fillRect(x, y + gy, w, cell)
      }
      ctx.globalAlpha = 1
      break
    }
    case 'dots': {
      ctx.fillStyle = p
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = s
      for (let dy = 9; dy < h; dy += 18) {
        for (let dx = 9; dx < w; dx += 18) {
          ctx.beginPath()
          ctx.arc(x + dx, y + dy, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
    case 'border': {
      const g = ctx.createLinearGradient(x, y, x + w, y + h)
      g.addColorStop(0, s)
      g.addColorStop(1, d)
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = p
      ctx.fillRect(x + 10, y + 10, w - 20, h - 20)
      break
    }
    case 'linen':
    case 'herringbone':
    case 'damask':
    case 'solid':
    default: {
      const g = ctx.createLinearGradient(x, y, x + w, y + h)
      g.addColorStop(0, s)
      g.addColorStop(0.5, p)
      g.addColorStop(1, d)
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
      if (padrao === 'linen' || padrao === 'herringbone') {
        ctx.strokeStyle = 'rgba(0,0,0,0.04)'
        ctx.lineWidth = 1
        for (let i = 0; i < w; i += 3) {
          ctx.beginPath()
          ctx.moveTo(x + i, y)
          ctx.lineTo(x + i, y + h)
          ctx.stroke()
        }
      }
      break
    }
  }

  ctx.restore()
}

function tamanhoCamada(codigo: string, largura: number, comprimento: number): number {
  const base = Math.max(largura, comprimento, 1)
  const escala = Math.min(base / 40, 1.2)
  if (codigo === 'sousplat') return 280 * escala
  if (codigo === 'pratoRaso') return 220 * escala
  if (codigo === 'pratoFundo') return 180 * escala
  if (codigo === 'pratoSobremesa') return 140 * escala
  if (codigo === 'portaGuardanapo') return 90 * escala
  if (codigo === 'taca') return 120 * escala
  return 160 * escala
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
