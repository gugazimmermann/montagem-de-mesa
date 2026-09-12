import type { Categoria, ConfiguracaoMesa, ItemMesa } from '../../compartilhado/tipos'
import { criarConfiguracaoVazia } from '../catalogo'

const PARAM_MONTAGEM = 'm'

/**
 * Serializa seleções como `cat:item|cat:item`.
 * Sem encode por token: `URLSearchParams` cuida do encoding da query
 * (evita double-decode / URIError ao ler).
 */
export function serializarMontagem(configuracao: ConfiguracaoMesa): string {
  return Object.entries(configuracao)
    .filter((entrada): entrada is [string, string] => Boolean(entrada[1]))
    .map(([cat, id]) => `${cat}:${id}`)
    .join('|')
}

/** Lê parâmetro `m` da URL e mescla com categorias válidas. */
export function lerMontagemDaUrl(
  search: string,
  categorias: Categoria[],
  itens: ItemMesa[],
): ConfiguracaoMesa | null {
  try {
    const params = new URLSearchParams(
      search.startsWith('?') ? search : search ? `?${search}` : '',
    )
    const bruto = params.get(PARAM_MONTAGEM)
    if (!bruto) return null

    const base = criarConfiguracaoVazia(categorias)
    const idsCategoria = new Set(categorias.map((c) => c.id))
    const idsItem = new Set(itens.map((i) => i.id))

    for (const parte of bruto.split('|')) {
      if (!parte) continue
      const sep = parte.indexOf(':')
      if (sep < 0) continue
      const cat = parte.slice(0, sep)
      const id = parte.slice(sep + 1)
      if (!cat || !id) continue
      if (!idsCategoria.has(cat) || !idsItem.has(id)) continue
      const item = itens.find((i) => i.id === id)
      if (item && item.categoria !== cat) continue
      base[cat] = id
    }

    return base
  } catch {
    return null
  }
}

export function urlComMontagem(
  pathname: string,
  configuracao: ConfiguracaoMesa,
): string {
  const serializado = serializarMontagem(configuracao)
  if (!serializado) return pathname
  const params = new URLSearchParams()
  params.set(PARAM_MONTAGEM, serializado)
  return `${pathname}?${params.toString()}`
}

export function temSelecao(configuracao: ConfiguracaoMesa): boolean {
  return Object.values(configuracao).some(Boolean)
}

/** Compara duas configurações pela serialização canônica. */
export function mesmaMontagem(a: ConfiguracaoMesa, b: ConfiguracaoMesa): boolean {
  return serializarMontagem(a) === serializarMontagem(b)
}
