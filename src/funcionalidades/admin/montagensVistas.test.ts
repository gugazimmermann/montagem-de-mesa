import { describe, expect, it } from 'vitest'
import { montagemContaComoNaoVista } from './montagensVistas'

describe('montagemContaComoNaoVista', () => {
  const marca = '2026-10-08T04:00:00.000Z'

  it('conta quando ainda não há marca', () => {
    expect(montagemContaComoNaoVista(marca, null)).toBe(true)
  })

  it('conta só o que é posterior à marca', () => {
    expect(montagemContaComoNaoVista('2026-10-08T04:00:01.000Z', marca)).toBe(true)
    expect(montagemContaComoNaoVista(marca, marca)).toBe(false)
    expect(montagemContaComoNaoVista('2026-10-08T03:59:59.000Z', marca)).toBe(false)
  })
})
