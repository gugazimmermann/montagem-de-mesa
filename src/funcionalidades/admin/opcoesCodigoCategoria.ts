/** Opções de layout (codigo) para categorias editáveis no admin. */
export const OPCOES_CODIGO_CATEGORIA: {
  valor: string
  rotulo: string
  dica: string
}[] = [
  {
    valor: 'lugarAmericano',
    rotulo: 'Lugar americano',
    dica: 'Base retangular sob o lugar',
  },
  {
    valor: 'sousplat',
    rotulo: 'Sousplat',
    dica: 'Base redonda sob o prato',
  },
  {
    valor: 'pratoRaso',
    rotulo: 'Prato raso',
    dica: 'Prato principal',
  },
  {
    valor: 'pratoFundo',
    rotulo: 'Prato fundo',
    dica: 'Prato de sopa / fundo',
  },
  {
    valor: 'pratoSobremesa',
    rotulo: 'Prato de sobremesa',
    dica: 'Prato menor no topo',
  },
  {
    valor: 'guardanapo',
    rotulo: 'Guardanapo',
    dica: 'Sobre o prato ou ao lado',
  },
  {
    valor: 'portaGuardanapo',
    rotulo: 'Porta-guardanapo',
    dica: 'Peça sobre o guardanapo',
  },
  {
    valor: 'talher',
    rotulo: 'Talheres',
    dica: 'Permite vários itens (esquerda/direita)',
  },
  {
    valor: 'taca',
    rotulo: 'Taças / copos',
    dica: 'Escolha única; canto superior direito',
  },
  {
    valor: '',
    rotulo: 'Outro (genérico)',
    dica: 'Centralizado, sem posição de etiqueta',
  },
]
