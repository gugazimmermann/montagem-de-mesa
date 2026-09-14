import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import {
  AssinaturaAdmin,
  AtualizarCadastroAdmin,
  CadastroAdmin,
  CategoriaPainel,
  FormularioCategoria,
  FormularioItem,
  HistoricoMontagensAdmin,
  LoginAdmin,
  PainelAdmin,
  RecuperarSenhaAdmin,
  RedefinirSenhaAdmin,
} from '../funcionalidades/admin'
import { RotaProtegida } from '../funcionalidades/autenticacao'
import { PaginaCliente } from './PaginaCliente'

function RedirectCSlug() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={slug ? `/${slug}` : '/raffiner'} replace />
}

export function Rotas() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/raffiner" replace />} />
      <Route path="/admin" element={<LoginAdmin />} />
      <Route path="/entrar" element={<LoginAdmin />} />
      <Route path="/cadastro" element={<CadastroAdmin />} />
      <Route path="/admin/recuperar-senha" element={<RecuperarSenhaAdmin />} />
      <Route path="/admin/redefinir-senha" element={<RedefinirSenhaAdmin />} />
      <Route
        path="/admin/assinatura"
        element={
          <RotaProtegida>
            <AssinaturaAdmin />
          </RotaProtegida>
        }
      />
      <Route
        path="/admin/painel"
        element={
          <RotaProtegida>
            <PainelAdmin />
          </RotaProtegida>
        }
      />
      <Route
        path="/admin/painel/cadastro"
        element={
          <RotaProtegida>
            <AtualizarCadastroAdmin />
          </RotaProtegida>
        }
      />
      <Route
        path="/admin/painel/montagens"
        element={
          <RotaProtegida>
            <HistoricoMontagensAdmin />
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
      <Route path="/c/:slug" element={<RedirectCSlug />} />
      <Route path="/:slug" element={<PaginaCliente />} />
      <Route path="*" element={<Navigate to="/raffiner" replace />} />
    </Routes>
  )
}
