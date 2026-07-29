export type IdCategoria = string

export type PadraoTecido =
  | 'solid'
  | 'linen'
  | 'stripes'
  | 'gingham'
  | 'damask'
  | 'dots'
  | 'herringbone'
  | 'border'

export interface DimensoesItem {
  largura: number
  comprimento: number
}

export interface ItemMesa {
  id: string
  nome: string
  categoria: IdCategoria
  /** URL pública de foto do produto (ex.: sousplats) */
  imagem?: string
  /** Tokens de cor para o preview quando não há imagem */
  cores: {
    primaria: string
    secundaria?: string
    destaque?: string
  }
  /** Largura em cm (exceto toalhas) */
  largura?: number
  /** Comprimento em cm (exceto toalhas) */
  comprimento?: number
  /** Padrão do tecido para toalhas */
  padrao?: PadraoTecido
  descricao?: string
}

export type ConfiguracaoMesa = Record<string, string | null>

export interface Categoria {
  id: IdCategoria
  rotulo: string
  descricao: string
}

export interface Cliente {
  id: string
  slug: string
  email: string
  nome: string
  logo: string
}

export interface DadosCliente {
  nome: string
  logo: string
  categorias: Categoria[]
  itens: ItemMesa[]
}

export interface Credenciais {
  email: string
  senha: string
}
