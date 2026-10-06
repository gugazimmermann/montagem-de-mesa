import { describe, expect, it } from 'vitest'
import type { ItemMesa } from '../../compartilhado/tipos'
import {
  classificarTalher,
  LAYER_LEFT_PCT,
  LAYER_TOP_PCT,
  posicionarPortaGuardanapo,
  posicionarTacas,
  posicionarTalheres,
  raioPratoVisualPct,
  RAIO_VISUAL_FATOR,
  TACA_OFFSET_X_PCT,
  TACA_OFFSET_Y_PCT,
  TALHER_MARGEM_PRATO_PCT,
  TALHER_PITCH_PCT,
} from './layoutEtiqueta'
import {
  aplicarSelecao,
  ehCategoriaMulti,
  idsSelecionados,
} from '../catalogo'
import { serializarMontagem, lerMontagemDaUrl } from './montagemUrl'

function item(parcial: Partial<ItemMesa> & Pick<ItemMesa, 'id' | 'nome'>): ItemMesa {
  return {
    categoria: 'talher',
    cores: { primaria: '#ccc' },
    ...parcial,
  }
}

describe('classificarTalher', () => {
  it('reconhece tipos pelo nome', () => {
    expect(classificarTalher('Garfo de Mesa Agra')).toBe('garfo')
    expect(classificarTalher('Faca de Mesa')).toBe('faca')
    expect(classificarTalher('Colher de Mesa')).toBe('colherMesa')
    expect(classificarTalher('Colher de Sobremesa')).toBe('sobremesa')
    expect(classificarTalher('Garfo de sobremesa Bambu')).toBe('sobremesa')
  })
})

describe('posicionarTalheres', () => {
  const raio = 32

  it('coloca colher+garfo à esquerda, faca à direita, sobremesa no topo', () => {
    const pos = posicionarTalheres(
      [
        item({ id: '1', nome: 'Colher de Mesa', largura: 3, comprimento: 24 }),
        item({ id: '2', nome: 'Garfo de Mesa', largura: 3, comprimento: 24 }),
        item({ id: '3', nome: 'Faca de Mesa', largura: 3, comprimento: 24 }),
        item({ id: '4', nome: 'Colher de Sobremesa', largura: 2.5, comprimento: 16 }),
      ],
      raio,
    )
    const porId = Object.fromEntries(pos.map((p) => [p.item.id, p]))
    expect(porId['1']!.posicao.leftPct).toBeLessThan(50)
    expect(porId['2']!.posicao.leftPct).toBeLessThan(50)
    expect(porId['1']!.posicao.leftPct).toBeLessThan(porId['2']!.posicao.leftPct)
    expect(porId['3']!.posicao.leftPct).toBeGreaterThan(50)
    expect(porId['4']!.posicao.rotateDeg).toBe(-90)
    expect(porId['4']!.posicao.topPct).toBeLessThan(LAYER_TOP_PCT)
    // Mais perto do prato do que o gap antigo (raio + 8)
    expect(porId['4']!.posicao.topPct).toBeGreaterThan(LAYER_TOP_PCT - raio - 8)
  })

  it('espelha margem do garfo e da faca internos', () => {
    const pos = posicionarTalheres(
      [
        item({ id: 'g', nome: 'Garfo de Mesa', largura: 3, comprimento: 24 }),
        item({ id: 'f', nome: 'Faca de Mesa', largura: 3, comprimento: 24 }),
      ],
      raio,
    )
    const garfo = pos.find((p) => p.item.id === 'g')!
    const faca = pos.find((p) => p.item.id === 'f')!
    const distEsq = Math.abs(garfo.posicao.leftPct - LAYER_LEFT_PCT)
    const distDir = Math.abs(faca.posicao.leftPct - LAYER_LEFT_PCT)
    expect(Math.abs(distEsq - distDir)).toBeLessThanOrEqual(0.5)
  })

  it('mantém pitch ≈ TALHER_PITCH_PCT entre talheres do mesmo lado', () => {
    const pos = posicionarTalheres(
      [
        item({ id: 'g1', nome: 'Garfo de Mesa', largura: 3, comprimento: 24 }),
        item({ id: 'g2', nome: 'Garfo de Entrada', largura: 3, comprimento: 20 }),
        item({ id: 'f1', nome: 'Faca de Mesa', largura: 3, comprimento: 24 }),
        item({ id: 'f2', nome: 'Faca de Entrada', largura: 3, comprimento: 20 }),
      ],
      raio,
    )
    expect(pos).toHaveLength(4)
    const esq = pos
      .filter((p) => p.posicao.leftPct < 50)
      .sort((a, b) => a.posicao.leftPct - b.posicao.leftPct)
    const dir = pos
      .filter((p) => p.posicao.leftPct > 50)
      .sort((a, b) => a.posicao.leftPct - b.posicao.leftPct)
    expect(esq).toHaveLength(2)
    expect(dir).toHaveLength(2)
    const pitchEsq = esq[1]!.posicao.leftPct - esq[0]!.posicao.leftPct
    const pitchDir = dir[1]!.posicao.leftPct - dir[0]!.posicao.leftPct
    expect(Math.abs(pitchEsq - TALHER_PITCH_PCT)).toBeLessThanOrEqual(0.5)
    expect(Math.abs(pitchDir - TALHER_PITCH_PCT)).toBeLessThanOrEqual(0.5)
  })
})

describe('posicionarTacas', () => {
  const raio = 32

  it('ordena a mais baixa mais perto do prato e ancora no centro', () => {
    const pos = posicionarTacas(
      [
        item({
          id: 'alta',
          nome: 'Taça Vinho',
          categoria: 'taca',
          comprimento: 22,
          largura: 9,
        }),
        item({
          id: 'baixa',
          nome: 'Taça Água',
          categoria: 'taca',
          comprimento: 14,
          largura: 10,
        }),
      ],
      raio,
    )
    expect(pos[0]!.item.id).toBe('baixa')
    expect(pos[0]!.posicao.leftPct).toBeLessThan(pos[1]!.posicao.leftPct)
    expect(pos[0]!.posicao.ancora).toBe('centro')
  })

  it('coloca a 1ª taça fora do disco, mas perto (offsets compactos)', () => {
    const pos = posicionarTacas(
      [
        item({
          id: 't',
          nome: 'Taça Água',
          categoria: 'taca',
          comprimento: 14,
          largura: 10,
        }),
      ],
      raio,
    )
    const p = pos[0]!.posicao
    expect(p.leftPct).toBeCloseTo(
      LAYER_LEFT_PCT + raio + TACA_OFFSET_X_PCT,
      5,
    )
    expect(p.topPct).toBeCloseTo(
      LAYER_TOP_PCT - raio - TACA_OFFSET_Y_PCT,
      5,
    )
    const dx = p.leftPct - LAYER_LEFT_PCT
    const dy = p.topPct - LAYER_TOP_PCT
    const dist = Math.hypot(dx, dy)
    expect(dist).toBeGreaterThan(raio + TALHER_MARGEM_PRATO_PCT)
    // Mais perto que o layout antigo (offsets 14/18)
    const distAntigo = Math.hypot(raio + 14, -(raio + 18))
    expect(dist).toBeLessThan(distAntigo)
  })

  it('com lugar americano sobe e afasta a taça', () => {
    const itemTaca = item({
      id: 't',
      nome: 'Taça Água',
      categoria: 'taca',
      comprimento: 14,
      largura: 10,
    })
    const sem = posicionarTacas([itemTaca], raio)
    const com = posicionarTacas([itemTaca], raio, { comLugarAmericano: true })
    expect(com[0]!.posicao.topPct).toBeLessThan(sem[0]!.posicao.topPct)
    expect(com[0]!.posicao.leftPct).toBeGreaterThan(sem[0]!.posicao.leftPct)
    expect(com[0]!.posicao.topPct).toBeCloseTo(
      LAYER_TOP_PCT - raio - (TACA_OFFSET_Y_PCT + 8),
      5,
    )
  })

  it('com sousplat afasta a taça para fora do disco', () => {
    const itemTaca = item({
      id: 't',
      nome: 'Taça Água',
      categoria: 'taca',
      comprimento: 14,
      largura: 10,
    })
    const sem = posicionarTacas([itemTaca], raio)
    const com = posicionarTacas([itemTaca], raio, { comSousplat: true })
    expect(com[0]!.posicao.topPct).toBeLessThan(sem[0]!.posicao.topPct)
    expect(com[0]!.posicao.leftPct).toBeGreaterThan(sem[0]!.posicao.leftPct)
    expect(com[0]!.posicao.leftPct).toBeCloseTo(
      LAYER_LEFT_PCT + raio + TACA_OFFSET_X_PCT + 4,
      5,
    )
    expect(com[0]!.posicao.topPct).toBeCloseTo(
      LAYER_TOP_PCT - raio - (TACA_OFFSET_Y_PCT + 5),
      5,
    )
  })
})

describe('raioPratoVisualPct', () => {
  it('aplica RAIO_VISUAL_FATOR sobre o raio geométrico', () => {
    const scale = 1.232
    const ancora = 33
    const geometrico = ((ancora / ((75 * 9) / 13)) * 100 * scale) / 2
    expect(raioPratoVisualPct(ancora, scale)).toBeCloseTo(
      geometrico * RAIO_VISUAL_FATOR,
      5,
    )
  })
})

describe('posicionarPortaGuardanapo', () => {
  it('fica acima do centro do guardanapo (anel de madeira)', () => {
    const pos = posicionarPortaGuardanapo(
      item({ id: 'p', nome: 'Porta Pérola', categoria: 'portaGuardanapo' }),
      28,
    )
    expect(pos.posicao.topPct).toBeLessThan(66)
    expect(pos.larguraCm).toBeGreaterThan(0)
  })
})

describe('seleção multi e URL', () => {
  it('alterna IDs em categorias multi', () => {
    expect(ehCategoriaMulti('talher')).toBe(true)
    expect(ehCategoriaMulti('taca')).toBe(false)
    expect(ehCategoriaMulti('sousplat')).toBe(false)
    let s = aplicarSelecao(null, 'a', true)
    expect(idsSelecionados(s)).toEqual(['a'])
    s = aplicarSelecao(s, 'b', true)
    expect(idsSelecionados(s)).toEqual(['a', 'b'])
    s = aplicarSelecao(s, 'a', true)
    expect(idsSelecionados(s)).toEqual(['b'])
  })

  it('taça é seleção única', () => {
    let s = aplicarSelecao(null, 't1', false)
    expect(s).toBe('t1')
    s = aplicarSelecao(s, 't2', false)
    expect(s).toBe('t2')
  })

  it('serializa e lê vários talheres', () => {
    const categorias = [
      { id: 'talher', rotulo: 'Talheres', descricao: '' },
      { id: 'sousplat', rotulo: 'Sousplats', descricao: '' },
    ]
    const itens = [
      item({ id: 't1', nome: 'Garfo', categoria: 'talher' }),
      item({ id: 't2', nome: 'Faca', categoria: 'talher' }),
      item({ id: 's1', nome: 'Sousplat', categoria: 'sousplat' }),
    ]
    const serial = serializarMontagem({
      talher: ['t1', 't2'],
      sousplat: 's1',
    })
    expect(serial).toContain('talher:t1,t2')
    const lida = lerMontagemDaUrl(`?m=${serial}`, categorias, itens)
    expect(idsSelecionados(lida?.talher)).toEqual(['t1', 't2'])
    expect(lida?.sousplat).toBe('s1')
  })
})
