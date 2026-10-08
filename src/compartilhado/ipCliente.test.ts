import { describe, expect, it } from 'vitest'
import { ipCliente } from '../../supabase/functions/_shared/ipCliente.ts'

function headers(valores: Record<string, string>) {
  return {
    get(name: string) {
      return valores[name.toLowerCase()] ?? null
    },
  }
}

describe('ipCliente', () => {
  it('prefere cf-connecting-ip', () => {
    expect(
      ipCliente(
        headers({
          'cf-connecting-ip': '203.0.113.8',
          'x-forwarded-for': '1.2.3.4, 203.0.113.8',
        }),
      ),
    ).toBe('203.0.113.8')
  })

  it('usa o último salto de x-forwarded-for', () => {
    expect(
      ipCliente(headers({ 'x-forwarded-for': '1.2.3.4, 198.51.100.20' })),
    ).toBe('198.51.100.20')
  })

  it('sem cabeçalho devolve unknown', () => {
    expect(ipCliente(headers({}))).toBe('unknown')
  })
})
