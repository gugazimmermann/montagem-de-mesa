import type {
  Categoria,
  ConfiguracaoMesa,
  ItemMesa,
  ItemMontagemEnviada,
  SelecaoCategoria,
} from '../../compartilhado/tipos'
import {
  criarConfiguracaoVazia,
  ehCategoriaMulti,
  idsSelecionados,
  temSelecaoNaCategoria,
} from '../catalogo'

const PARAM_MONTAGEM = 'm'

function serializarSelecao(cat: string, selecao: SelecaoCategoria): string | null {
  const ids = idsSelecionados(selecao)
  if (ids.length === 0) return null
  return `${cat}:${ids.join(',')}`
}

/**
 * Serializa seleções como `cat:item|cat:id1,id2`.
 * Sem encode por token: `URLSearchParams` cuida do encoding da query
 * (evita double-decode / URIError ao ler).
 */
export function serializarMontagem(configuracao: ConfiguracaoMesa): string {
  return Object.entries(configuracao)
    .map(([cat, selecao]) => serializarSelecao(cat, selecao))
    .filter((parte): parte is string => Boolean(parte))
    .join('|')
}

function aplicarIdNaBase(
  base: ConfiguracaoMesa,
  categorias: Categoria[],
  itens: ItemMesa[],
  cat: string,
  id: string,
): void {
  const idsCategoria = new Set(categorias.map((c) => c.id))
  const idsItem = new Set(itens.map((i) => i.id))
  if (!idsCategoria.has(cat) || !idsItem.has(id)) return
  const item = itens.find((i) => i.id === id)
  if (item && item.categoria !== cat) return

  const categoria = categorias.find((c) => c.id === cat)
  if (!categoria) return

  if (ehCategoriaMulti(categoria)) {
    const atuais = idsSelecionados(base[cat])
    if (!atuais.includes(id)) {
      base[cat] = [...atuais, id]
    }
  } else {
    base[cat] = id
  }
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

    for (const parte of bruto.split('|')) {
      if (!parte) continue
      const sep = parte.indexOf(':')
      if (sep < 0) continue
      const cat = parte.slice(0, sep)
      const idsBrutos = parte.slice(sep + 1)
      if (!cat || !idsBrutos) continue
      for (const id of idsBrutos.split(',')) {
        if (!id) continue
        aplicarIdNaBase(base, categorias, itens, cat, id)
      }
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
  return Object.values(configuracao).some((s) => temSelecaoNaCategoria(s))
}

/** Compara duas configurações pela serialização canônica. */
export function mesmaMontagem(a: ConfiguracaoMesa, b: ConfiguracaoMesa): boolean {
  return serializarMontagem(a) === serializarMontagem(b)
}

function normalizarRotulo(valor: string): string {
  return valor.trim().toLocaleLowerCase('pt-BR')
}

/** Reconstrói configuração a partir de rótulos/nomes salvos no histórico. */
export function configuracaoDeItensEnviados(
  itensEnviados: ItemMontagemEnviada[],
  categorias: Categoria[],
  itensCatalogo: ItemMesa[],
): ConfiguracaoMesa {
  const base = criarConfiguracaoVazia(categorias)
  for (const enviado of itensEnviados) {
    const rotulo = normalizarRotulo(enviado.categoria)
    const nome = normalizarRotulo(enviado.nome)
    if (!rotulo || !nome) continue
    const categoria = categorias.find(
      (c) => normalizarRotulo(c.rotulo) === rotulo,
    )
    if (!categoria) continue
    const item = itensCatalogo.find(
      (i) =>
        i.categoria === categoria.id && normalizarRotulo(i.nome) === nome,
    )
    if (!item) continue
    aplicarIdNaBase(base, categorias, itensCatalogo, categoria.id, item.id)
  }
  return base
}

function extrairParamM(linkSalvo: string): string | null {
  try {
    const u = new URL(linkSalvo)
    const m = u.searchParams.get(PARAM_MONTAGEM)?.trim()
    return m || null
  } catch {
    return null
  }
}

/**
 * Link absoluto para abrir a montagem no admin.
 * Prefere `?m=` do link salvo; senão resolve itens (rótulo+nome) no catálogo.
 * Sempre usa `window.location.origin` para abrir no host atual.
 */
export function linkAbrirMontagemAdmin(params: {
  slug: string
  linkSalvo: string
  itensEnviados: ItemMontagemEnviada[]
  categorias: Categoria[]
  itensCatalogo: ItemMesa[]
}): string {
  const { slug, linkSalvo, itensEnviados, categorias, itensCatalogo } = params
  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''
  const pathname = `/${slug}`

  const mSalvo = extrairParamM(linkSalvo)
  if (mSalvo) {
    const paramsM = new URLSearchParams()
    paramsM.set(PARAM_MONTAGEM, mSalvo)
    const daUrl = lerMontagemDaUrl(
      paramsM.toString(),
      categorias,
      itensCatalogo,
    )
    if (daUrl && temSelecao(daUrl)) {
      return `${origin}${urlComMontagem(pathname, daUrl)}`
    }
  }

  const reconstruida = configuracaoDeItensEnviados(
    itensEnviados,
    categorias,
    itensCatalogo,
  )
  if (temSelecao(reconstruida)) {
    return `${origin}${urlComMontagem(pathname, reconstruida)}`
  }

  return `${origin}${pathname}`
}
