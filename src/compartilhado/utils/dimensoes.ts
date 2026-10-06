import type { CSSProperties } from 'react'
import type { DimensoesItem, ItemMesa } from '../tipos'

type CategoriaMedida =
  | 'lugarAmericano'
  | 'sousplat'
  | 'pratoRaso'
  | 'pratoFundo'
  | 'pratoSobremesa'
  | 'guardanapo'
  | 'portaGuardanapo'
  | 'talher'
  | 'taca'

const PADROES_CATEGORIA: Record<CategoriaMedida, DimensoesItem> = {
  lugarAmericano: { largura: 48, comprimento: 35 },
  sousplat: { largura: 33, comprimento: 33 },
  pratoRaso: { largura: 27, comprimento: 27 },
  pratoFundo: { largura: 27, comprimento: 27 },
  pratoSobremesa: { largura: 20, comprimento: 20 },
  guardanapo: { largura: 45, comprimento: 45 },
  portaGuardanapo: { largura: 8, comprimento: 8 },
  talher: { largura: 3, comprimento: 20 },
  taca: { largura: 9, comprimento: 20 },
}

const PADROES_REDONDO: Partial<Record<CategoriaMedida, number>> = {
  sousplat: 36,
  pratoRaso: 27,
  pratoFundo: 27,
  pratoSobremesa: 20,
  portaGuardanapo: 8,
}

const FALLBACK_MEDIDA: DimensoesItem = { largura: 30, comprimento: 30 }

function ehCategoriaMedida(categoria: string): categoria is CategoriaMedida {
  return categoria in PADROES_CATEGORIA
}

/** Mesa 75×56,25 cm (4∶3); referência = lado do lugar (75 × 360/520) */
export const REFERENCIA_PREVIEW_CM = (75 * 9) / 13

/** Zoom visual uniforme das peças no lugar à mesa */
export const PREVIEW_SCALE = 1.12

/** Leve aumento só nos pratos (raso, fundo, sobremesa) */
export const PREVIEW_SCALE_PRATO = PREVIEW_SCALE * 1.1

/** Leve aumento só nas taças */
export const PREVIEW_SCALE_TACA = PREVIEW_SCALE * 1.155

function numeroCm(texto: string): number {
  return parseFloat(texto.replace(',', '.'))
}

export function inferirDimensoes(nome: string, categoria: string): DimensoesItem {
  const match3 = nome.match(
    /(\d+(?:[.,]\d+)?)(?:\s*cm)?\s*x\s*(\d+(?:[.,]\d+)?)(?:\s*cm)?\s*x\s*(\d+(?:[.,]\d+)?)\s*cm/i,
  )
  if (match3) {
    return {
      largura: numeroCm(match3[1]),
      comprimento: numeroCm(match3[3]),
    }
  }

  const matchRet = nome.match(
    /(\d+(?:[.,]\d+)?)(?:\s*cm)?\s*x\s*(\d+(?:[.,]\d+)?)\s*cm/i,
  )
  if (matchRet) {
    const a = numeroCm(matchRet[1])
    const b = numeroCm(matchRet[2])
    if (categoria === 'talher') return { largura: b, comprimento: a }
    return { largura: a, comprimento: b }
  }

  const matchDiam = nome.match(/(\d+(?:[.,]\d+)?)\s*cm/i)
  if (matchDiam) {
    const diametro = numeroCm(matchDiam[1])
    return { largura: diametro, comprimento: diametro }
  }

  const padraoCategoria = ehCategoriaMedida(categoria)
    ? PADROES_CATEGORIA[categoria]
    : FALLBACK_MEDIDA

  if (/redondo/i.test(nome)) {
    const diametro = ehCategoriaMedida(categoria)
      ? (PADROES_REDONDO[categoria] ?? padraoCategoria.largura)
      : padraoCategoria.largura
    return { largura: diametro, comprimento: diametro }
  }

  if (/base mdf|sousplat mdf/i.test(nome)) {
    return { largura: 30, comprimento: 30 }
  }

  if (/mini sousplat|petit/i.test(nome)) {
    return { largura: 26, comprimento: 26 }
  }

  return { ...padraoCategoria }
}

export function temDimensoes(
  item: ItemMesa,
): item is ItemMesa & DimensoesItem {
  return item.largura != null && item.comprimento != null
}

export function itemRedondo(item: ItemMesa & DimensoesItem): boolean {
  return item.largura === item.comprimento || /redondo/i.test(item.nome)
}

export function formatarDimensoes(item: ItemMesa & DimensoesItem): string {
  if (item.largura === item.comprimento) {
    return `Ø ${formatarCm(item.largura)} cm`
  }
  return `${formatarCm(item.largura)} × ${formatarCm(item.comprimento)} cm`
}

function formatarCm(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace('.', ',')
}

export function estiloCamadaDimensionada(item: ItemMesa & DimensoesItem): CSSProperties {
  return {
    '--item-largura': item.largura,
    '--item-comprimento': item.comprimento,
  } as CSSProperties
}
