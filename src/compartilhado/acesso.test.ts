import { describe, expect, it } from 'vitest'
import {
  clienteTemAcesso,
  diasRestantesPastDue,
  diasRestantesTrial,
  GRACA_PAST_DUE_MS,
} from '../compartilhado/tipos'
import {
  lerMontagemDaUrl,
  linkAbrirMontagemAdmin,
  mesmaMontagem,
  serializarMontagem,
  urlComMontagem,
} from '../funcionalidades/mesa/montagemUrl'
import type { Categoria, ItemMesa } from '../compartilhado/tipos'

const base = {
  trialEndsAt: null as string | null,
  currentPeriodEnd: null as string | null,
}

describe('clienteTemAcesso', () => {
  const agora = Date.parse('2026-09-14T12:00:00.000Z')

  it('libera trial vigente', () => {
    expect(
      clienteTemAcesso(
        {
          ...base,
          subscriptionStatus: 'trialing',
          trialEndsAt: '2026-09-20T00:00:00.000Z',
        },
        agora,
      ),
    ).toBe(true)
  })

  it('bloqueia trial expirado ou sem data', () => {
    expect(
      clienteTemAcesso(
        {
          ...base,
          subscriptionStatus: 'trialing',
          trialEndsAt: '2026-09-01T00:00:00.000Z',
        },
        agora,
      ),
    ).toBe(false)
    expect(
      clienteTemAcesso(
        { ...base, subscriptionStatus: 'trialing', trialEndsAt: null },
        agora,
      ),
    ).toBe(false)
  })

  it('exige currentPeriodEnd para active', () => {
    expect(
      clienteTemAcesso(
        {
          ...base,
          subscriptionStatus: 'active',
          currentPeriodEnd: '2026-10-01T00:00:00.000Z',
        },
        agora,
      ),
    ).toBe(true)
    expect(
      clienteTemAcesso(
        { ...base, subscriptionStatus: 'active', currentPeriodEnd: null },
        agora,
      ),
    ).toBe(false)
  })

  it('past_due usa graça de 7 dias a partir do período', () => {
    const fimPeriodo = '2026-09-10T12:00:00.000Z'
    expect(
      clienteTemAcesso(
        {
          ...base,
          subscriptionStatus: 'past_due',
          currentPeriodEnd: fimPeriodo,
        },
        agora,
      ),
    ).toBe(true)

    const depoisDaGraca =
      Date.parse(fimPeriodo) + GRACA_PAST_DUE_MS + 1000
    expect(
      clienteTemAcesso(
        {
          ...base,
          subscriptionStatus: 'past_due',
          currentPeriodEnd: fimPeriodo,
        },
        depoisDaGraca,
      ),
    ).toBe(false)
  })

  it('conta dias de trial e past_due', () => {
    expect(
      diasRestantesTrial(
        {
          subscriptionStatus: 'trialing',
          trialEndsAt: '2026-09-16T12:00:00.000Z',
        },
        agora,
      ),
    ).toBe(2)
    expect(
      diasRestantesPastDue(
        {
          subscriptionStatus: 'past_due',
          currentPeriodEnd: '2026-09-10T12:00:00.000Z',
        },
        agora,
      ),
    ).toBe(3)
  })
})

describe('montagemUrl', () => {
  const categorias: Categoria[] = [
    { id: 'cat-a', rotulo: 'A', descricao: '' },
    { id: 'cat-b', rotulo: 'B', descricao: '' },
  ]
  const itens: ItemMesa[] = [
    {
      id: 'item-1',
      nome: 'Um',
      categoria: 'cat-a',
      cores: { primaria: '#000000' },
    },
    {
      id: 'item-2',
      nome: 'Dois',
      categoria: 'cat-b',
      cores: { primaria: '#ffffff' },
    },
  ]

  it('serializa e restaura seleções', () => {
    const config = { 'cat-a': 'item-1', 'cat-b': 'item-2' }
    const serial = serializarMontagem(config)
    expect(serial).toContain('cat-a:item-1')
    const url = urlComMontagem('/loja', config)
    const lido = lerMontagemDaUrl(url.split('?')[1]!, categorias, itens)
    expect(lido).not.toBeNull()
    expect(mesmaMontagem(lido!, config)).toBe(true)
  })

  it('ignora ids inválidos', () => {
    const lido = lerMontagemDaUrl(
      'm=cat-a:fantasma|cat-b:item-2',
      categorias,
      itens,
    )
    expect(lido?.['cat-a']).toBeNull()
    expect(lido?.['cat-b']).toBe('item-2')
  })

  it('reconstrói link admin a partir de rótulo+nome quando link não tem m', () => {
    const href = linkAbrirMontagemAdmin({
      slug: 'raffiner',
      linkSalvo: 'http://localhost:5173/raffiner',
      itensEnviados: [
        { categoria: 'A', nome: 'Um' },
        { categoria: 'B', nome: 'Dois' },
      ],
      categorias,
      itensCatalogo: itens,
    })
    expect(href).toContain('/raffiner?')
    expect(href).toContain('m=')
    expect(decodeURIComponent(href)).toContain('cat-a:item-1')
    expect(decodeURIComponent(href)).toContain('cat-b:item-2')
  })
})
