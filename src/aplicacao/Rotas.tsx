import { Navigate, Route, Routes } from 'react-router-dom'
import {
  CadastroAdmin,
  CategoriaPainel,
  FormularioCategoria,
  FormularioItem,
  LoginAdmin,
  PainelAdmin,
} from '../funcionalidades/admin'
import { RotaProtegida } from '../funcionalidades/autenticacao'
import { PaginaCliente } from './PaginaCliente'

export function Rotas() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/c/raffiner" replace />} />
      <Route path="/c/:slug" element={<PaginaCliente />} />
      <Route path="/admin" element={<LoginAdmin />} />
      <Route path="/entrar" element={<LoginAdmin />} />
      <Route path="/cadastro" element={<CadastroAdmin />} />
      <Route
        path="/admin/painel"
        element={
          <RotaProtegida>
            <PainelAdmin />
          </RotaProtegida>
        }
      />
      <Route
        path="/admin/painel/categorias/novo"
        element={
          <RotaProtegida>
            <FormularioCategoria />
          </RotaProtegida>
        }
      />
      <Route
        path="/admin/painel/categorias/:categoriaId"
        element={
          <RotaProtegida>
            <CategoriaPainel />
          </RotaProtegida>
        }
      />
      <Route
        path="/admin/painel/categorias/:categoriaId/itens/novo"
        element={
          <RotaProtegida>
            <FormularioItem />
          </RotaProtegida>
        }
      />
      <Route
        path="/admin/painel/categorias/:categoriaId/itens/:itemId"
        element={
          <RotaProtegida>
            <FormularioItem />
          </RotaProtegida>
        }
      />
      <Route path="*" element={<Navigate to="/c/raffiner" replace />} />
    </Routes>
  )
}
