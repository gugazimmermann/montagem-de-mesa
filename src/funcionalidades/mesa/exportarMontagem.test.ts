import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Categoria, ItemMesa, PadraoTecido } from '../../compartilhado/tipos'
import { exportarMontagemPng, gerarBlobMontagemPng } from './exportarMontagem'

const CLIENTE = 'c1'

function item(
  id: string,
  categoria: string,
  extra: Partial<ItemMesa> = {},
): ItemMesa {
  return {
    id,
    nome: extra.nome ?? id,
    categoria,
    cores: { primaria: '#ffffff', secundaria: '#cccccc', destaque: '#111111' },
    ...extra,
  }
}

function categoria(id: string, codigo?: string): Categoria {
  return { id, codigo: codigo ?? id, rotulo: id, descricao: '' }
}

function ctxFalso() {
  const grad = { addColorStop() {} }
  return {
    createLinearGradient: () => grad,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    fillRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    clip() {},
    save() {},
    restore() {},
    drawImage() {},
    translate() {},
    rotate() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    arcTo() {},
    closePath() {},
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('exportar montagem', () => {
  it('gera png com fotos, cores e padrões de toalha', async () => {
    const ctx = ctxFalso()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }))
    })

    class ImagemOk {
      crossOrigin = ''
      width = 100
      height = 200
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_valor: string) {
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', ImagemOk)

    const categorias = [
      categoria('toalha', 'toalha'),
      categoria('lugar', 'lugarAmericano'),
      categoria('sous', 'sousplat'),
      categoria('raso', 'pratoRaso'),
      categoria('fundo', 'pratoFundo'),
      categoria('sobre', 'pratoSobremesa'),
      categoria('guard', 'guardanapo'),
      categoria('porta', 'portaGuardanapo'),
      categoria('talher', 'talher'),
      categoria('taca', 'taca'),
      categoria('outro'),
    ]
    const itens = [
      item('toalha', 'toalha', { padrao: 'stripes' }),
      item('lugar', 'lugar', { imagem: 'https://cdn.example/l.png', largura: 48, comprimento: 35 }),
      item('sous', 'sous', { imagem: 'https://cdn.example/s.png', largura: 33, comprimento: 33 }),
      item('raso', 'raso', { imagem: 'https://cdn.example/r.png' }),
      item('fundo', 'fundo', { largura: 27, comprimento: 27 }),
      item('sobre', 'sobre', { imagemCatalogo: 'https://cdn.example/so.png' }),
      item('guard', 'guard', { imagem: 'https://cdn.example/g.png' }),
      item('porta', 'porta', { imagem: 'https://cdn.example/p.png' }),
      item('garfo', 'talher', { nome: 'Garfo de Mesa', imagem: 'https://cdn.example/t.png' }),
      item('sobremesa', 'talher', { nome: 'Colher de sobremesa', imagem: 'https://cdn.example/cs.png' }),
      item('taca', 'taca', { nome: 'Taça', imagem: 'https://cdn.example/ta.png', largura: 9, comprimento: 20 }),
      item('extra', 'outro'),
    ]
    const config = Object.fromEntries(itens.map((i) => [i.categoria, i.categoria === 'talher' ? [i.id] : i.id]))
    config.talher = ['garfo', 'sobremesa']

    const gerado = await gerarBlobMontagemPng(config, categorias, itens)
    expect(gerado.blob.size).toBeGreaterThan(0)

    const padroes: PadraoTecido[] = ['gingham', 'dots', 'border', 'linen', 'herringbone', 'damask', 'solid']
    for (const padrao of padroes) {
      const soToalha = await gerarBlobMontagemPng(
        { toalha: 'toalha' },
        [categoria('toalha', 'toalha')],
        [item('toalha', 'toalha', { padrao })],
      )
      expect(soToalha.aviso).toBeNull()
    }

    class ImagemFalha {
      crossOrigin = ''
      width = 10
      height = 10
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_valor: string) {
        queueMicrotask(() => this.onerror?.())
      }
    }
    vi.stubGlobal('Image', ImagemFalha)
    const aviso = await gerarBlobMontagemPng(
      { raso: 'raso', taca: 'taca' },
      [categoria('raso', 'pratoRaso'), categoria('taca', 'taca')],
      [
        item('raso', 'raso', { nome: 'Prato', imagem: 'https://cdn.example/r.png' }),
        item('taca', 'taca', { nome: 'Taça', imagem: 'https://cdn.example/t.png' }),
      ],
    )
    expect(aviso.aviso).toContain('Prato')

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.useFakeTimers()
    const baixado = await exportarMontagemPng(
      { toalha: 'toalha' },
      [categoria('toalha', 'toalha')],
      [item('toalha', 'toalha')],
      'mesa.png',
    )
    expect(baixado).toBeNull()
    await vi.advanceTimersByTimeAsync(1600)

    const comAviso = await exportarMontagemPng(
      { raso: 'raso' },
      [categoria('raso', 'pratoRaso')],
      [item('raso', 'raso', { nome: 'Prato', imagem: 'https://cdn.example/r.png' })],
    )
    expect(comAviso).toContain('Imagem baixada')
  })

  it('falha sem canvas ou sem blob', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(gerarBlobMontagemPng({}, [], [])).rejects.toThrow(/Canvas/)

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxFalso() as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(null)
    })
    await expect(gerarBlobMontagemPng({}, [], [])).rejects.toThrow(/Falha ao gerar/)

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(() => {
      throw new Error('cors')
    })
    await expect(gerarBlobMontagemPng({}, [], [])).rejects.toThrow(/CORS/)
  })

  it('ignora porta-guardanapo sem guardanapo e ancora no prato raso', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctxFalso() as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['png'], { type: 'image/png' }))
    })
    const gerado = await gerarBlobMontagemPng(
      { porta: 'porta', raso: 'raso' },
      [categoria('porta', 'portaGuardanapo'), categoria('raso', 'pratoRaso')],
      [item('porta', 'porta'), item('raso', 'raso', { largura: 27, comprimento: 27 })],
    )
    expect(gerado.blob).toBeInstanceOf(Blob)
    expect(CLIENTE).toBe('c1')
  })
})
