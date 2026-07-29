import { Navigate, useParams } from 'react-router-dom'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import { EditarCategoria } from './EditarCategoria'
import { VisualizarCategoria } from './VisualizarCategoria'

export function CategoriaPainel() {
  const { categoriaId } = useParams<{ categoriaId: string }>()

  if (!categoriaId) {
    return <Navigate to="/admin/painel" replace />
  }

  if (ehCategoriaFixa(categoriaId)) {
    return <VisualizarCategoria />
  }

  return <EditarCategoria />
}
