import { describe, expect, it } from 'vitest'
import { avisoFotosAusentes } from '../funcionalidades/mesa/exportarMontagem'
import { taxaEnvio } from '../dados/repositorioFunil'
import { podeMover, passosTroca } from '../funcionalidades/admin/arrasteOrdem'
import {
  fimDoDiaLocal,
  inicioDoDiaLocal,
  leadNovoParado,
  montagensParaCsv,
} from '../funcionalidades/admin/csvMontagens'
import type { MontagemEnviada } from '../compartilhado/tipos'

describe('avisoFotosAusentes', () => {
  it('cita a peça que faltou no PNG', () => {
    expect(avisoFotosAusentes(['Taça cristal'])).toBe(
      'Não foi possível incluir Taça cristal.',
    )
    expect(avisoFotosAusentes(['Taça', 'Prato'])).toBe(
      'Não foi possível incluir: Taça, Prato.',
    )
    expect(avisoFotosAusentes([])).toBeNull()
  })
})

describe('taxaEnvio', () => {
  it('divide envios pelas visitas', () => {
    expect(taxaEnvio(1, 4)).toBe(0.25)
    expect(taxaEnvio(3, 0)).toBeNull()
    expect(taxaEnvio(3, null)).toBeNull()
  })
})

describe('arraste', () => {
  it('troca vizinhos até o destino', () => {
    expect(passosTroca(0, 2)).toEqual([
      [0, 1],
      [1, 2],
    ])
    expect(passosTroca(2, 0)).toEqual([
      [2, 1],
      [1, 0],
    ])
  })

  it('não atravessa item bloqueado', () => {
    expect(podeMover(0, 2, (indice) => indice === 1)).toBe(false)
    expect(podeMover(0, 2, () => false)).toBe(true)
  })
})

describe('leads e csv', () => {
  const agora = Date.parse('2026-10-08T12:00:00.000Z')

  it('marca lead novo parado há 24 h', () => {
    expect(leadNovoParado('novo', '2026-10-07T12:00:00.000Z', agora)).toBe(true)
    expect(leadNovoParado('novo', '2026-10-08T10:00:00.000Z', agora)).toBe(false)
    expect(leadNovoParado('contatado', '2026-10-01T12:00:00.000Z', agora)).toBe(
      false,
    )
  })

  it('monta o intervalo do dia local', () => {
    expect(inicioDoDiaLocal('2026-10-08')).toMatch(/^2026-10-08T/)
    expect(fimDoDiaLocal('2026-10-08')! > inicioDoDiaLocal('2026-10-08')!).toBe(
      true,
    )
    expect(inicioDoDiaLocal('08/10/2026')).toBeUndefined()
  })

  it('escapa aspas no csv', () => {
    const montagem = {
      id: '1',
      clienteId: 'c',
      visitanteNome: 'Ana "Nita"',
      visitanteEmail: 'a@b.co',
      visitanteWhatsapp: '5511999999999',
      visitanteEndereco: '',
      visitanteCidade: 'São Paulo',
      visitanteEstado: 'SP',
      itens: [{ categoria: 'Prato', nome: 'Raso' }],
      linkMontagem: 'https://exemplo.test/loja?m=1',
      createdAt: '2026-10-08T12:00:00.000Z',
      emailStatus: 'sent',
      leadStatus: 'novo',
      notaInterna: '',
    } satisfies MontagemEnviada
    const csv = montagensParaCsv([montagem])
    expect(csv.startsWith('\uFEFFdata,nome,')).toBe(true)
    expect(csv).toContain('"Ana ""Nita"""')
  })
})
