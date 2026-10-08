/** Nomes fixos de src/dados/toalhas.json. O teste toalhasPermitidas.test.ts impede divergência. */
const NOMES = [
  'Branco linho',
  'Marfim clássico',
  'Azul marinho',
  'Verde eucalipto',
  'Bordô formal',
  'Listras preto e branco',
  'Xadrez vichy vermelho',
  'Rosa com poás',
  'Dourado festa',
  'Cinza grafite',
  'Bege natural',
  'Azul celeste',
  'Terracota',
  'Lavanda suave',
  'Preto elegante',
  'Verde oliva',
  'Coral suave',
  'Mostarda',
  'Prata festa',
  'Xadrez azul',
  'Listras verde',
  'Champagne',
  'Caramelo',
  'Azul petróleo',
  'Pêssego',
  'Vinho escuro',
  'Branco neve',
] as const

const NOMES_NORMALIZADOS = new Set(NOMES.map((nome) => nome.trim().toLowerCase()))

export function ehCategoriaToalha(categoria: string): boolean {
  const cat = categoria.trim().toLowerCase()
  return cat === 'toalha' || cat === 'toalhas'
}

export function ehToalhaPermitida(nome: string): boolean {
  return NOMES_NORMALIZADOS.has(nome.trim().toLowerCase())
}
