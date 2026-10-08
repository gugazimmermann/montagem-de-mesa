function definirMeta(
  chave: string,
  conteudo: string,
  atributo: 'name' | 'property',
) {
  let el = document.head.querySelector(`meta[${atributo}="${chave}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(atributo, chave)
    document.head.appendChild(el)
  }
  el.setAttribute('content', conteudo)
}

export function aplicarMetaLoja(opcoes: {
  nome: string
  descricao: string
  url: string
  imagem?: string
}) {
  const nome = opcoes.nome.trim() || 'Montagem de Mesa'
  document.title = `${nome} · Montagem de Mesa`
  definirMeta('description', opcoes.descricao, 'name')
  definirMeta('og:title', nome, 'property')
  definirMeta('og:description', opcoes.descricao, 'property')
  definirMeta('og:type', 'website', 'property')
  definirMeta('og:url', opcoes.url, 'property')
  if (opcoes.imagem) definirMeta('og:image', opcoes.imagem, 'property')
}

export function limparMetaLoja() {
  document.title = 'Montagem de Mesa'
}
