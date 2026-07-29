import type { Categoria, DadosCliente, ItemMesa } from '../compartilhado/tipos'
import seedToalhas from './toalhas.json'

export const ID_CATEGORIA_TOALHA = 'toalha'

export const CATEGORIA_TOALHA_FIXA = seedToalhas.categoria as Categoria
export const ITENS_TOALHA_FIXOS = seedToalhas.itens as ItemMesa[]

export function ehCategoriaFixa(id: string): boolean {
  return id === ID_CATEGORIA_TOALHA
}

export function mesclarToalhasFixas(dados: DadosCliente): DadosCliente {
  const categoriasCliente = dados.categorias.filter((c) => c.id !== ID_CATEGORIA_TOALHA)
  const itensCliente = dados.itens.filter((i) => i.categoria !== ID_CATEGORIA_TOALHA)

  return {
    ...dados,
    categorias: [CATEGORIA_TOALHA_FIXA, ...categoriasCliente],
    itens: [...ITENS_TOALHA_FIXOS, ...itensCliente],
  }
}

export function extrairDadosCliente(dados: DadosCliente): DadosCliente {
  return {
    ...dados,
    categorias: dados.categorias.filter((c) => !ehCategoriaFixa(c.id)),
    itens: dados.itens.filter((i) => !ehCategoriaFixa(i.categoria)),
  }
}
