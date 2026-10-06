import type { ItemMesa } from '../../compartilhado/tipos'
import {
  GUARDANAPO_ASPECT_LARGURA,
  GUARDANAPO_ALTURA_VISUAL_CM,
  inferirDimensoes,
  PREVIEW_SCALE,
  REFERENCIA_PREVIEW_CM,
  temDimensoes,
} from '../../compartilhado/utils/dimensoes'

export type TipoTalher =
  | 'garfo'
  | 'faca'
  | 'colherMesa'
  | 'sobremesa'
  | 'outro'

/** Fração do topo da bbox do guardanapo onde está o anel de madeira (centro Y). */
export const ANEL_GUARDANAPO_TOP_FRAC = 0.28

/** Tamanho do porta ≈ fração da altura visual do guardanapo (cobre o anel). */
export const PORTA_FRAC_ALTURA_GUARDANAPO = 0.22

/** Borda do prato → borda do talher interno (% do place-setting). */
export const TALHER_MARGEM_PRATO_PCT = 2.0

/** Centro → centro entre talheres vizinhos do mesmo lado. */
export const TALHER_PITCH_PCT = 5.0

/** Borda do prato → centro da colher de sobremesa. */
export const SOBREMESA_MARGEM_PCT = 3.0

/** Offset radial da 1ª taça além da borda do prato (X). */
export const TACA_OFFSET_X_PCT = 6

/** Offset acima da borda do prato para a 1ª taça (Y). */
export const TACA_OFFSET_Y_PCT = 14

/** Passo diagonal entre taças sucessivas. */
export const TACA_PASSO_X_PCT = 8
export const TACA_PASSO_Y_PCT = 6

/**
 * PNGs de prato/sousplat têm padding transparente; o raio visível
 * é menor que a caixa CSS (`object-fit: contain`).
 */
export const RAIO_VISUAL_FATOR = 0.88

/** Centro Y padrão das peças empilhadas (espelha CSS `top: 66%`). */
export const LAYER_TOP_PCT = 66

/** Centro X padrão. */
export const LAYER_LEFT_PCT = 50

/** Raio do stack em % do place-setting (borda visível aproximada). */
export function raioPratoVisualPct(
  ancoraCm: number,
  scalePrato: number,
): number {
  return (
    ((ancoraCm / REFERENCIA_PREVIEW_CM) * 100 * scalePrato * RAIO_VISUAL_FATOR) /
    2
  )
}

export type AncoraPosicao = 'centro' | 'topoEsquerdo'

export interface PosicaoCamada {
  /** % do place-setting (centro se ancora=centro; canto SE se topoEsquerdo). */
  leftPct: number
  topPct: number
  rotateDeg: number
  ancora: AncoraPosicao
  zIndex: number
}

export interface TalherPosicionado {
  item: ItemMesa
  tipo: TipoTalher
  posicao: PosicaoCamada
  /** Dimensões de desenho (cm). */
  larguraCm: number
  comprimentoCm: number
}

export interface TacaPosicionada {
  item: ItemMesa
  posicao: PosicaoCamada
  larguraCm: number
  comprimentoCm: number
}

export interface PortaPosicionado {
  item: ItemMesa
  posicao: PosicaoCamada
  larguraCm: number
  comprimentoCm: number
}

export function classificarTalher(nome: string): TipoTalher {
  const n = nome.toLocaleLowerCase('pt-BR')
  if (/colher/.test(n) && /sobremesa|doce|caf[eé]/.test(n)) return 'sobremesa'
  if (/garfo/.test(n) && /sobremesa|doce|caf[eé]/.test(n)) return 'sobremesa'
  if (/faca/.test(n) && /sobremesa|doce|manteiga|entrada|salada/.test(n)) {
    return 'faca'
  }
  if (/colher/.test(n)) return 'colherMesa'
  if (/garfo/.test(n)) return 'garfo'
  if (/faca/.test(n)) return 'faca'
  return 'outro'
}

function ehExterno(nome: string): boolean {
  return /sobremesa|entrada|salada|peixe|doce|caf[eé]|manteiga/i.test(nome)
}

function dimensoesItem(item: ItemMesa, codigo: string) {
  if (temDimensoes(item)) {
    return { largura: item.largura, comprimento: item.comprimento }
  }
  return inferirDimensoes(item.nome, codigo)
}

/** Meia-largura visual do talher em % do place-setting. */
export function meiaLarguraTalherPct(larguraCm: number): number {
  return (larguraCm / REFERENCIA_PREVIEW_CM) * 100 * PREVIEW_SCALE * 0.5
}

/**
 * Ordena talheres para etiqueta:
 * esquerda fora→dentro: colheres de mesa, depois garfos (externos primeiro);
 * direita dentro→fora: facas (mesa perto do prato);
 * topo: sobremesa.
 */
export function posicionarTalheres(
  itens: ItemMesa[],
  /** Raio visual aproximado do prato/sousplat em % do place-setting. */
  raioPratoPct: number = 32,
): TalherPosicionado[] {
  const classificados = itens.map((item) => ({
    item,
    tipo: classificarTalher(item.nome),
  }))

  const colheres = classificados.filter((c) => c.tipo === 'colherMesa')
  const garfos = classificados
    .filter((c) => c.tipo === 'garfo')
    .sort((a, b) => Number(ehExterno(b.item.nome)) - Number(ehExterno(a.item.nome)))
  const facas = classificados
    .filter((c) => c.tipo === 'faca')
    .sort((a, b) => Number(ehExterno(a.item.nome)) - Number(ehExterno(b.item.nome)))
  const sobremesas = classificados.filter((c) => c.tipo === 'sobremesa')
  const outros = classificados.filter((c) => c.tipo === 'outro')

  const esquerda = [...colheres, ...garfos]
  const direita = [...facas, ...outros]

  const resultado: TalherPosicionado[] = []
  let z = 7

  // Esquerda: índice 0 = mais externo; último = mais perto do prato
  esquerda.forEach((c, i) => {
    const fromInner = esquerda.length - 1 - i
    const dims = dimensoesItem(c.item, 'talher')
    const half = meiaLarguraTalherPct(dims.largura)
    const leftPct =
      LAYER_LEFT_PCT -
      raioPratoPct -
      TALHER_MARGEM_PRATO_PCT -
      half -
      fromInner * TALHER_PITCH_PCT
    resultado.push({
      item: c.item,
      tipo: c.tipo,
      larguraCm: dims.largura,
      comprimentoCm: dims.comprimento,
      posicao: {
        leftPct,
        topPct: LAYER_TOP_PCT,
        rotateDeg: 0,
        ancora: 'centro',
        zIndex: z++,
      },
    })
  })

  // Direita: índice 0 = mais perto do prato
  direita.forEach((c, i) => {
    const dims = dimensoesItem(c.item, 'talher')
    const half = meiaLarguraTalherPct(dims.largura)
    const leftPct =
      LAYER_LEFT_PCT +
      raioPratoPct +
      TALHER_MARGEM_PRATO_PCT +
      half +
      i * TALHER_PITCH_PCT
    resultado.push({
      item: c.item,
      tipo: c.tipo,
      larguraCm: dims.largura,
      comprimentoCm: dims.comprimento,
      posicao: {
        leftPct,
        topPct: LAYER_TOP_PCT,
        rotateDeg: 0,
        ancora: 'centro',
        zIndex: z++,
      },
    })
  })

  // Topo: horizontal, cabo à direita (asset vertical, cabeça no topo → -90°)
  sobremesas.forEach((c, i) => {
    const dims = dimensoesItem(c.item, 'talher')
    const topPct =
      LAYER_TOP_PCT - raioPratoPct - SOBREMESA_MARGEM_PCT - i * TALHER_PITCH_PCT * 0.5
    resultado.push({
      item: c.item,
      tipo: c.tipo,
      larguraCm: dims.largura,
      comprimentoCm: dims.comprimento,
      posicao: {
        leftPct: LAYER_LEFT_PCT,
        topPct,
        rotateDeg: -90,
        ancora: 'centro',
        zIndex: z++,
      },
    })
  })

  return resultado
}

/**
 * Taças: menor comprimento mais perto do prato; desempate = ordem de seleção.
 * Âncora no centro, fora do disco do prato (sem overlap).
 * Com lugar americano, offsets extras para a taça ficar fora do jogo.
 */
export function posicionarTacas(
  itens: ItemMesa[],
  raioPratoPct: number = 32,
  opcoes?: { comLugarAmericano?: boolean },
): TacaPosicionada[] {
  const comDims = itens.map((item, ordem) => {
    const dims = dimensoesItem(item, 'taca')
    return { item, dims, ordem }
  })
  comDims.sort((a, b) => {
    const d = a.dims.comprimento - b.dims.comprimento
    return d !== 0 ? d : a.ordem - b.ordem
  })

  const offsetX =
    TACA_OFFSET_X_PCT + (opcoes?.comLugarAmericano ? 4 : 0)
  const offsetY =
    TACA_OFFSET_Y_PCT + (opcoes?.comLugarAmericano ? 8 : 0)

  return comDims.map(({ item, dims }, i) => ({
    item,
    larguraCm: dims.largura,
    comprimentoCm: dims.comprimento,
    posicao: {
      leftPct:
        LAYER_LEFT_PCT + raioPratoPct + offsetX + i * TACA_PASSO_X_PCT,
      topPct:
        LAYER_TOP_PCT - raioPratoPct - offsetY - i * TACA_PASSO_Y_PCT,
      rotateDeg: 0,
      ancora: 'centro',
      zIndex: 8 + i,
    },
  }))
}

export function dimensoesGuardanapoVisual(
  alturaAncoraCm: number = GUARDANAPO_ALTURA_VISUAL_CM,
): { largura: number; comprimento: number } {
  return {
    largura: alturaAncoraCm * GUARDANAPO_ASPECT_LARGURA,
    comprimento: alturaAncoraCm,
  }
}

/** Porta centrado no anel de madeira do PNG do guardanapo. */
export function posicionarPortaGuardanapo(
  item: ItemMesa,
  alturaGuardanapoCm: number = GUARDANAPO_ALTURA_VISUAL_CM,
): PortaPosicionado {
  const tamanho = alturaGuardanapoCm * PORTA_FRAC_ALTURA_GUARDANAPO
  const alturaPctAprox =
    (alturaGuardanapoCm / REFERENCIA_PREVIEW_CM) * 100 * PREVIEW_SCALE
  const topPct =
    LAYER_TOP_PCT + (ANEL_GUARDANAPO_TOP_FRAC - 0.5) * alturaPctAprox

  return {
    item,
    larguraCm: tamanho,
    comprimentoCm: tamanho,
    posicao: {
      leftPct: LAYER_LEFT_PCT,
      topPct,
      rotateDeg: 0,
      ancora: 'centro',
      zIndex: 6,
    },
  }
}

/** Converte posição %-place em origem (px) da caixa no canvas de export. */
export function origemPxDePosicao(
  posicao: PosicaoCamada,
  boxW: number,
  boxH: number,
  placeX: number,
  placeY: number,
  placeSize: number,
): { x: number; y: number } {
  const left = placeX + placeSize * (posicao.leftPct / 100)
  const top = placeY + placeSize * (posicao.topPct / 100)
  if (posicao.ancora === 'topoEsquerdo') {
    return { x: left, y: top }
  }
  return { x: left - boxW / 2, y: top - boxH / 2 }
}
