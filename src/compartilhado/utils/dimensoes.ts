import type { CSSProperties } from 'react'
import type { DimensoesItem, ItemMesa } from '../tipos'

type CategoriaMedida =
  | 'sousplat'
  | 'pratoRaso'
  | 'pratoFundo'
  | 'pratoSobremesa'
  | 'portaGuardanapo'
  | 'taca'

const PADROES_CATEGORIA: Record<CategoriaMedida, DimensoesItem> = {
  sousplat: { largura: 36, comprimento: 36 },
  pratoRaso: { largura: 27, comprimento: 27 },
  pratoFundo: { largura: 27, comprimento: 27 },
  pratoSobremesa: { largura: 20, comprimento: 20 },
  portaGuardanapo: { largura: 8, comprimento: 8 },
  taca: { largura: 12, comprimento: 22 },
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

/** Referência visual: maior peça (comprimento) mapeada à área do lugar */
export const REFERENCIA_PREVIEW_CM = 46

export function inferirDimensoes(nome: string, categoria: string): DimensoesItem {
  const matchRet = nome.match(/(\d+)\s*x\s*(\d+)\s*cm/i)
  if (matchRet) {
    return {
      largura: Number(matchRet[1]),
      comprimento: Number(matchRet[2]),
    }
  }

  const matchDiam = nome.match(/(\d+(?:[.,]\d+)?)\s*cm/i)
  if (matchDiam) {
    const diametro = parseFloat(matchDiam[1].replace(',', '.'))
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
