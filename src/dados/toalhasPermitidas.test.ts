import { describe, expect, it } from 'vitest'
import toalhas from './toalhas.json'
import { ehToalhaPermitida } from '../../supabase/functions/_shared/toalhasPermitidas.ts'

describe('toalhas permitidas no envio', () => {
  it('aceita cada nome do catálogo fixo e recusa um nome arbitrário', () => {
    for (const item of toalhas.itens) {
      expect(ehToalhaPermitida(item.nome)).toBe(true)
    }
    expect(ehToalhaPermitida('Toalha inventada')).toBe(false)
  })
})
