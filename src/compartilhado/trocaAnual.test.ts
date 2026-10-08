import { describe, expect, it } from 'vitest'
import { calcularTrocaAnual } from '../../supabase/functions/_shared/trocaAnual.ts'

describe('calcularTrocaAnual', () => {
  it('mês pago até 8/11/2026 cobra a fração até 31/12/2026', () => {
    const conta = calcularTrocaAnual({
      fimPeriodoMensal: new Date('2026-11-08T03:00:00.000Z'),
    })
    expect(conta.inicioAnual.toISOString()).toBe('2026-11-08T03:00:00.000Z')
    expect(conta.fim.toISOString()).toBe('2027-01-01T02:59:59.999Z')
    expect(conta.aCobrarCentavos).toBe(7973)
  })

  it('período que termina em 31/12 não cobra agora', () => {
    const conta = calcularTrocaAnual({
      fimPeriodoMensal: new Date('2027-01-01T02:59:59.999Z'),
    })
    expect(conta.aCobrarCentavos).toBe(0)
    expect(conta.fim.toISOString()).toBe('2027-01-01T02:59:59.999Z')
  })

  it('início em janeiro vale até 31/12 desse mesmo ano', () => {
    const conta = calcularTrocaAnual({
      fimPeriodoMensal: new Date('2027-01-08T03:00:00.000Z'),
    })
    expect(conta.fim.toISOString()).toBe('2028-01-01T02:59:59.999Z')
    expect(conta.aCobrarCentavos).toBeGreaterThan(0)
    expect(conta.aCobrarCentavos).toBeLessThan(53892)
  })
})
