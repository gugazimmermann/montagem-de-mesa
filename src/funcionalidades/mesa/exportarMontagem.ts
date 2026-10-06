import type { ConfiguracaoMesa, Categoria, ItemMesa, PadraoTecido } from '../../compartilhado/tipos'
import { imagemMesaItem } from '../../compartilhado/tipos'
import {
  dimensoesVisuaisGuardanapo,
  GUARDANAPO_ALTURA_VISUAL_CM,
  inferirDimensoes,
  PREVIEW_SCALE,
  PREVIEW_SCALE_GUARDANAPO,
  PREVIEW_SCALE_PRATO,
  PREVIEW_SCALE_TACA,
  REFERENCIA_PREVIEW_CM,
  temDimensoes,
} from '../../compartilhado/utils/dimensoes'
import {
  idsSelecionados,
  obterItensPorIds,
} from '../catalogo'
import {
  origemPxDePosicao,
  posicionarPortaGuardanapo,
  posicionarTacas,
  posicionarTalheres,
  raioPratoVisualPct,
  type PosicaoCamada,
} from './layoutEtiqueta'
import { chaveCamada, ordenarCategoriasPorCamada } from './ordemCamadas'

const LARGURA = 800
const ALTURA = 600
const TIMEOUT_IMAGEM_MS = 8000

/** Caixa do lugar à mesa (espelha `.place-setting` no preview). */
const PLACE_SIZE = Math.min(360, LARGURA * 0.45)
/** Viés à esquerda espelhando `margin-right` do preview (só sem lugar americano). */
const PLACE_BIAS_X = PLACE_SIZE * 0.06

type GeometriaLugar = {
  placeX: number
  placeY: number
  placeSize: number
  layerCx: number
  layerCy: number
}

function geometriaLugar(comLugarAmericano: boolean): GeometriaLugar {
  const placeX =
    (LARGURA - PLACE_SIZE) / 2 - (comLugarAmericano ? 0 : PLACE_BIAS_X)
  const bottomClear = comLugarAmericano ? 0.14 : 0.08
  const placeY = ALTURA - PLACE_SIZE - ALTURA * bottomClear
  return {
    placeX,
    placeY,
    placeSize: PLACE_SIZE,
    layerCx: placeX + PLACE_SIZE * 0.5,
    layerCy: placeY + PLACE_SIZE * 0.66,
  }
}

type CamadaExport = {
  item: ItemMesa
  codigo: string
  larguraCm: number
  comprimentoCm: number
  posicao?: PosicaoCamada
}

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
  if (codigo === 'guardanapo') return PREVIEW_SCALE_GUARDANAPO
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

function origemCaixaPadrao(
  codigo: string,
  boxW: number,
  boxH: number,
  geo: GeometriaLugar,
): { x: number; y: number } {
  if (codigo === 'taca') {
    return {
      x: geo.placeX + geo.placeSize * 0.75,
      y: geo.placeY + geo.placeSize * -0.15,
    }
  }
  if (codigo === 'talher') {
    return {
      x: geo.placeX + geo.placeSize * 1.08 - boxW / 2,
      y: geo.layerCy - boxH / 2,
    }
  }
  return {
    x: geo.layerCx - boxW / 2,
    y: geo.layerCy - boxH / 2,
  }
}

function desenharImagemNaCaixa(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  alinhar: 'center' | 'bottom' = 'center',
  rotateDeg = 0,
): void {
  const ratio = Math.min(boxW / img.width, boxH / img.height)
  const w = img.width * ratio
  const h = img.height * ratio
  const x = boxX + (boxW - w) / 2
  const y = alinhar === 'bottom' ? boxY + (boxH - h) : boxY + (boxH - h) / 2

  if (!rotateDeg) {
    ctx.drawImage(img, x, y, w, h)
    return
  }

  const cx = boxX + boxW / 2
  const cy = boxY + boxH / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotateDeg * Math.PI) / 180)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  ctx.restore()
}

function montarCamadas(
  configuracao: ConfiguracaoMesa,
  categorias: Categoria[],
  itens: ItemMesa[],
): CamadaExport[] {
  const porCodigo = new Map<string, ItemMesa[]>()
  for (const categoria of categorias) {
    const codigo = chaveCamada(categoria)
    const ids = idsSelecionados(configuracao[categoria.id])
    const selecionados = obterItensPorIds(itens, ids)
    if (selecionados.length > 0) {
      porCodigo.set(codigo, selecionados)
    }
  }

  const sousplat = porCodigo.get('sousplat')?.[0]
  const pratoRaso = porCodigo.get('pratoRaso')?.[0]
  const ancoraCm = sousplat
    ? dimensoesParaExport(sousplat, 'sousplat').largura
    : pratoRaso
      ? dimensoesParaExport(pratoRaso, 'pratoRaso').largura
      : GUARDANAPO_ALTURA_VISUAL_CM

  const dimsGuardanapo = dimensoesVisuaisGuardanapo(
    porCodigo.get('guardanapo')?.[0] ?? ({ nome: '' } as ItemMesa),
    Math.min(ancoraCm, GUARDANAPO_ALTURA_VISUAL_CM + 2),
  )

  const raioPratoPct = raioPratoVisualPct(ancoraCm, PREVIEW_SCALE_PRATO)
  const comLugarAmericano = Boolean(porCodigo.get('lugarAmericano')?.length)
  const comSousplat = Boolean(sousplat)

  const ordem = ordenarCategoriasPorCamada(categorias)
  const camadas: CamadaExport[] = []

  for (const categoria of ordem) {
    const codigo = chaveCamada(categoria)
    const selecionados = porCodigo.get(codigo)
    if (!selecionados?.length) continue

    if (codigo === 'toalha') {
      camadas.push({
        item: selecionados[0]!,
        codigo,
        larguraCm: 0,
        comprimentoCm: 0,
      })
      continue
    }

    if (codigo === 'talher') {
      for (const pos of posicionarTalheres(selecionados, raioPratoPct)) {
        camadas.push({
          item: pos.item,
          codigo,
          larguraCm: pos.larguraCm,
          comprimentoCm: pos.comprimentoCm,
          posicao: pos.posicao,
        })
      }
      continue
    }

    if (codigo === 'taca') {
      for (const pos of posicionarTacas(selecionados, raioPratoPct, {
        comLugarAmericano,
        comSousplat,
      })) {
        camadas.push({
          item: pos.item,
          codigo,
          larguraCm: pos.larguraCm,
          comprimentoCm: pos.comprimentoCm,
          posicao: pos.posicao,
        })
      }
      continue
    }

    if (codigo === 'guardanapo') {
      camadas.push({
        item: selecionados[0]!,
        codigo,
        larguraCm: dimsGuardanapo.largura,
        comprimentoCm: dimsGuardanapo.comprimento,
      })
      continue
    }

    if (codigo === 'portaGuardanapo') {
      const guardanapo = porCodigo.get('guardanapo')?.[0]
      if (!guardanapo) continue
      const pos = posicionarPortaGuardanapo(
        selecionados[0]!,
        dimsGuardanapo.comprimento,
      )
      camadas.push({
        item: pos.item,
        codigo,
        larguraCm: pos.larguraCm,
        comprimentoCm: pos.comprimentoCm,
        posicao: pos.posicao,
      })
      continue
    }

    const item = selecionados[0]!
    const dims = dimensoesParaExport(item, codigo)
    camadas.push({
      item,
      codigo,
      larguraCm: dims.largura,
      comprimentoCm: dims.comprimento,
    })
  }

  return camadas
}

/**
 * Gera PNG da montagem sem baixar. Retorna blob + aviso opcional.
 */
export async function gerarBlobMontagemPng(
  configuracao: ConfiguracaoMesa,
  categorias: Categoria[],
  itens: ItemMesa[],
): Promise<{ blob: Blob; aviso: string | null }> {
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

  const camadas = montarCamadas(configuracao, categorias, itens)
  const comLugarAmericano = camadas.some((c) => c.codigo === 'lugarAmericano')
  const geo = geometriaLugar(comLugarAmericano)

  const imagens = await Promise.all(
    camadas.map(({ item, codigo }) => {
      const src = imagemMesaItem(item)
      return codigo !== 'toalha' && src
        ? carregarImagem(src)
        : Promise.resolve(null)
    }),
  )

  let imagensFalharam = 0

  for (let i = 0; i < camadas.length; i += 1) {
    const camada = camadas[i]!
    const { item, codigo, larguraCm, comprimentoCm, posicao } = camada

    if (codigo === 'toalha') {
      desenharToalha(ctx, item)
      continue
    }

    const { w: boxW, h: boxH } = caixaCamada(codigo, larguraCm, comprimentoCm)
    const { x: boxX, y: boxY } = posicao
      ? origemPxDePosicao(
          posicao,
          boxW,
          boxH,
          geo.placeX,
          geo.placeY,
          geo.placeSize,
        )
      : origemCaixaPadrao(codigo, boxW, boxH, geo)

    const img = imagens[i]
    if (imagemMesaItem(item)) {
      if (img) {
        desenharImagemNaCaixa(
          ctx,
          img,
          boxX,
          boxY,
          boxW,
          boxH,
          codigo === 'taca' ? 'bottom' : 'center',
          posicao?.rotateDeg ?? 0,
        )
        continue
      }
      imagensFalharam += 1
    }

    const raio = Math.min(boxW, boxH) / 2
    const cx = posicao
      ? boxX + boxW / 2
      : codigo === 'taca'
        ? boxX + boxW / 2
        : geo.layerCx
    const cy = posicao
      ? boxY + boxH / 2
      : codigo === 'taca'
        ? boxY + boxH / 2
        : geo.layerCy
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

  return {
    blob,
    aviso:
      imagensFalharam > 0
        ? 'Algumas fotos não carregaram (CORS ou rede).'
        : null,
  }
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
  const { blob, aviso } = await gerarBlobMontagemPng(
    configuracao,
    categorias,
    itens,
  )
  baixarBlob(blob, nomeArquivo)
  if (aviso) {
    return `Imagem baixada, mas ${aviso.toLowerCase()}`
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
