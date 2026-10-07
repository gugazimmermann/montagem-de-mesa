import { describe, expect, it } from 'vitest'
import {
  ehHexCor,
  normalizarHexCor,
  varsIdentidadeLoja,
} from './identidadeLoja'

describe('identidadeLoja', () => {
  it('valida e normaliza hex', () => {
    expect(ehHexCor('#3d5c4a')).toBe(true)
    expect(ehHexCor('#FFF')).toBe(false)
    expect(normalizarHexCor('3D5C4A')).toBe('#3d5c4a')
    expect(normalizarHexCor('')).toBe('')
    expect(normalizarHexCor('#xyzxyz')).toBe('')
  })

  it('gera vars de destaque e fundo', () => {
    const vars = varsIdentidadeLoja('#3d5c4a', '#eef1ef')
    expect(vars['--accent']).toBe('#3d5c4a')
    expect(vars['--on-accent']).toBe('#ffffff')
    expect(vars['--bg']).toBe('#eef1ef')
    expect(vars['--surface']).toContain('color-mix')
  })

  it('usa texto escuro em accent claro', () => {
    const vars = varsIdentidadeLoja('#f5e6c8', '')
    expect(vars['--on-accent']).toBe('#1a2421')
    expect(vars['--bg']).toBeUndefined()
  })
})
