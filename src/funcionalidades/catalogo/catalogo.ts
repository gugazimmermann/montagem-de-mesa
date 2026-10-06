import type {
  Categoria,
  ConfiguracaoMesa,
  IdCategoria,
  ItemMesa,
  SelecaoCategoria,
} from '../../compartilhado/tipos'

const CODIGOS_MULTI = new Set(['talher'])

function codigoCamada(categoria: Pick<Categoria, 'id' | 'codigo'>): string {
  return categoria.codigo ?? categoria.id
}

/** Categorias que aceitam vários itens ao mesmo tempo. */
export function ehCategoriaMulti(
  categoria: Pick<Categoria, 'id' | 'codigo'> | string,
): boolean {
  if (typeof categoria === 'string') return CODIGOS_MULTI.has(categoria)
  return CODIGOS_MULTI.has(codigoCamada(categoria))
}

/** Normaliza qualquer seleção para lista de IDs. */
export function idsSelecionados(selecao: SelecaoCategoria | undefined): string[] {
  if (selecao == null) return []
  if (Array.isArray(selecao)) return selecao.filter(Boolean)
  return selecao ? [selecao] : []
}

export function temSelecaoNaCategoria(selecao: SelecaoCategoria | undefined): boolean {
  return idsSelecionados(selecao).length > 0
}

/** Mesa vazia a partir das categorias do cliente */
export function criarConfiguracaoVazia(categorias: Categoria[]): ConfiguracaoMesa {
  return Object.fromEntries(categorias.map((c) => [c.id, null]))
}

export function obterItemPorId(itens: ItemMesa[], id: string | null): ItemMesa | null {
  if (!id) return null
  return itens.find((item) => item.id === id) ?? null
}

export function obterItensPorIds(itens: ItemMesa[], ids: string[]): ItemMesa[] {
  const porId = new Map(itens.map((i) => [i.id, i]))
  return ids.map((id) => porId.get(id)).filter((i): i is ItemMesa => Boolean(i))
}

export function obterItensPorCategoria(
  itens: ItemMesa[],
  idCategoria: IdCategoria,
): ItemMesa[] {
  return itens.filter((item) => item.categoria === idCategoria)
}

/**
 * Alterna item numa seleção multi, ou substitui numa single.
 * `idItem === null` limpa a categoria.
 */
export function aplicarSelecao(
  atual: SelecaoCategoria,
  idItem: string | null,
  multi: boolean,
): SelecaoCategoria {
  if (idItem == null) return null
  if (!multi) {
    return idItem
  }
  const ids = idsSelecionados(atual)
  if (ids.includes(idItem)) {
    const resto = ids.filter((id) => id !== idItem)
    return resto.length > 0 ? resto : null
  }
  return [...ids, idItem]
}
