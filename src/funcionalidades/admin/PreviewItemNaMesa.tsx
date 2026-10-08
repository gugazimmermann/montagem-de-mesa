import { useMemo } from 'react'
import type { Categoria, ItemMesa } from '../../compartilhado/tipos'
import { criarConfiguracaoVazia, ehCategoriaMulti } from '../catalogo'
import { PreVisualizacaoMesa } from '../mesa'

type Props = {
  categoria: Categoria
  item: ItemMesa
}

export function PreviewItemNaMesa({ categoria, item }: Props) {
  const configuracao = useMemo(() => {
    const base = criarConfiguracaoVazia([categoria])
    base[categoria.id] = ehCategoriaMulti(categoria) ? [item.id] : item.id
    return base
  }, [categoria, item])

  return (
    <div className="preview-item-na-mesa" aria-label="Pré-visualização na mesa">
      <PreVisualizacaoMesa
        configuracao={configuracao}
        categorias={[categoria]}
        itens={[item]}
      />
      <p className="m-0 text-xs text-muted">
        A base da peça fica na parte de baixo do quadro. Confira o enquadramento antes de
        salvar.
      </p>
    </div>
  )
}
