import type { ConfiguracaoMesa, Categoria, ItemMesa, PadraoTecido } from '../../compartilhado/tipos'
import {
  inferirDimensoes,
  PREVIEW_SCALE,
  PREVIEW_SCALE_PRATO,
  PREVIEW_SCALE_TACA,
  REFERENCIA_PREVIEW_CM,
  temDimensoes,
} from '../../compartilhado/utils/dimensoes'
import { obterItemPorId } from '../catalogo'
import { chaveCamada, ordenarCategoriasPorCamada } from './ordemCamadas'

const LARGURA = 800
const ALTURA = 600
const TIMEOUT_IMAGEM_MS = 8000

/** Caixa do lugar à mesa (espelha `.place-setting` no preview). */
const PLACE_SIZE = Math.min(360, LARGURA * 0.45)
const PLACE_X = (LARGURA - PLACE_SIZE) / 2 - PLACE_SIZE * 0.06
const PLACE_Y = ALTURA - PLACE_SIZE - ALTURA * 0.08

/** Centro das peças empilhadas (`left: 50%; top: 66%` + translate). */
const LAYER_CX = PLACE_X + PLACE_SIZE * 0.5
const LAYER_CY = PLACE_Y + PLACE_SIZE * 0.66

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

function escalaPreview(codigo: string): number {
  if (codigo === 'taca') return PREVIEW_SCALE_TACA
  if (codigo === 'pratoRaso' || codigo === 'pratoFundo' || codigo === 'pratoSobremesa') {
    return PREVIEW_SCALE_PRATO
  }
  return PREVIEW_SCALE
}

/** Tamanho da caixa da peça em px (mesma fórmula do CSS `--item-*` / referência). */
function caixaCamada(
  codigo: string,
  larguraCm: number,
  comprimentoCm: number,
): { w: number; h: number } {
  const scale = escalaPreview(codigo)
  return {
    w: (larguraCm / REFERENCIA_PREVIEW_CM) * PLACE_SIZE * scale,
    h: (comprimentoCm / REFERENCIA_PREVIEW_CM) * PLACE_SIZE * scale,
  }
}

/** Âncora da caixa: centro (pratos) ou canto superior esquerdo da taça (75% / -15%). */
function origemCaixa(
  codigo: string,
  boxW: number,
  boxH: number,
): { x: number; y: number } {
  if (codigo === 'taca') {
    return {
      x: PLACE_X + PLACE_SIZE * 0.75,
      y: PLACE_Y + PLACE_SIZE * -0.15,
    }
  }
  return {
    x: LAYER_CX - boxW / 2,
    y: LAYER_CY - boxH / 2,
  }
}

function desenharImagemNaCaixa(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  /** Taça no preview usa `object-position: center bottom`. */
  alinhar: 'center' | 'bottom' = 'center',
): void {
  const ratio = Math.min(boxW / img.width, boxH / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  const x = boxX + (boxW - w) / 2
  const y = alinhar === 'bottom' ? boxY + (boxH - h) : boxY + (boxH - h) / 2
  ctx.drawImage(img, x, y, w, h)
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
    const { w: boxW, h: boxH } = caixaCamada(codigo, dims.largura, dims.comprimento)
    const { x: boxX, y: boxY } = origemCaixa(codigo, boxW, boxH)

    if (item.imagem) {
      const img = await carregarImagem(item.imagem)
      if (img) {
        desenharImagemNaCaixa(
          ctx,
          img,
          boxX,
          boxY,
          boxW,
          boxH,
          codigo === 'taca' ? 'bottom' : 'center',
        )
        continue
      }
      imagensFalharam += 1
    }

    // Fallback de cor (alinha ao preview quando não há imagem).
    const raio = Math.min(boxW, boxH) / 2
    const cx = codigo === 'taca' ? boxX + boxW / 2 : LAYER_CX
    const cy = codigo === 'taca' ? boxY + boxH / 2 : LAYER_CY
    ctx.fillStyle = item.cores.primaria
    ctx.beginPath()
    ctx.arc(cx, cy, raio, 0, Math.PI * 2)
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
