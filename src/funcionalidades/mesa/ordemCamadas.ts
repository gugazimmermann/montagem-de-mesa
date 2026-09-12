import type { Categoria } from '../../compartilhado/tipos'

/** Ordem de empilhamento no preview e no export PNG (fundo → topo). */
export const CODIGOS_CAMADA = [
  'toalha',
  'sousplat',
  'pratoRaso',
  'pratoFundo',
  'pratoSobremesa',
  'portaGuardanapo',
  'taca',
] as const

export type CodigoCamada = (typeof CODIGOS_CAMADA)[number]

export function ehCodigoCamadaConhecido(codigo: string): codigo is CodigoCamada {
  return (CODIGOS_CAMADA as readonly string[]).includes(codigo)
}

export function chaveCamada(categoria: Pick<Categoria, 'id' | 'codigo'>): string {
  return categoria.codigo ?? categoria.id
}

/** Peso crescente = mais ao fundo. Desconhecidos ficam no topo (após taça). */
export function pesoCamada(codigo: string): number {
  const idx = (CODIGOS_CAMADA as readonly string[]).indexOf(codigo)
  return idx >= 0 ? idx : CODIGOS_CAMADA.length
}

export function ordenarCategoriasPorCamada(categorias: Categoria[]): Categoria[] {
  return [...categorias].sort(
    (a, b) => pesoCamada(chaveCamada(a)) - pesoCamada(chaveCamada(b)),
  )
}
