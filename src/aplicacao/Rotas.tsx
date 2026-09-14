import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { RotaProtegida } from '../funcionalidades/autenticacao'
import { PaginaCliente } from './PaginaCliente'

const LoginAdmin = lazy(() =>
  import('../funcionalidades/admin/LoginAdmin').then((m) => ({
    default: m.LoginAdmin,
  })),
)
const CadastroAdmin = lazy(() =>
  import('../funcionalidades/admin/CadastroAdmin').then((m) => ({
    default: m.CadastroAdmin,
  })),
)
const RecuperarSenhaAdmin = lazy(() =>
  import('../funcionalidades/admin/RecuperarSenhaAdmin').then((m) => ({
    default: m.RecuperarSenhaAdmin,
  })),
)
const RedefinirSenhaAdmin = lazy(() =>
  import('../funcionalidades/admin/RedefinirSenhaAdmin').then((m) => ({
    default: m.RedefinirSenhaAdmin,
  })),
)
const AssinaturaAdmin = lazy(() =>
  import('../funcionalidades/admin/AssinaturaAdmin').then((m) => ({
    default: m.AssinaturaAdmin,
  })),
)
const PainelAdmin = lazy(() =>
  import('../funcionalidades/admin/PainelAdmin').then((m) => ({
    default: m.PainelAdmin,
  })),
)
const AtualizarCadastroAdmin = lazy(() =>
  import('../funcionalidades/admin/AtualizarCadastroAdmin').then((m) => ({
    default: m.AtualizarCadastroAdmin,
  })),
)
const HistoricoMontagensAdmin = lazy(() =>
  import('../funcionalidades/admin/HistoricoMontagensAdmin').then((m) => ({
    default: m.HistoricoMontagensAdmin,
  })),
)
const FormularioCategoria = lazy(() =>
  import('../funcionalidades/admin/FormularioCategoria').then((m) => ({
    default: m.FormularioCategoria,
  })),
)
const CategoriaPainel = lazy(() =>
  import('../funcionalidades/admin/CategoriaPainel').then((m) => ({
    default: m.CategoriaPainel,
  })),
)
const FormularioItem = lazy(() =>
  import('../funcionalidades/admin/FormularioItem').then((m) => ({
    default: m.FormularioItem,
  })),
)

function RedirectCSlug() {
  const { slug } = useParams<{ slug: string }>()
  return <Navigate to={slug ? `/${slug}` : '/raffiner'} replace />
}

function AdminFallback() {
  return (
    <div className="app-shell app-shell--status" role="status">
      <p>Carregando…</p>
    </div>
  )
}

function comSuspense(elemento: ReactNode) {
  return <Suspense fallback={<AdminFallback />}>{elemento}</Suspense>
}

export function Rotas() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/raffiner" replace />} />
      <Route path="/admin" element={comSuspense(<LoginAdmin />)} />
      <Route path="/entrar" element={comSuspense(<LoginAdmin />)} />
      <Route path="/cadastro" element={comSuspense(<CadastroAdmin />)} />
      <Route
        path="/admin/recuperar-senha"
        element={comSuspense(<RecuperarSenhaAdmin />)}
      />
      <Route
        path="/admin/redefinir-senha"
        element={comSuspense(<RedefinirSenhaAdmin />)}
      />
      <Route
        path="/admin/assinatura"
        element={comSuspense(
          <RotaProtegida>
            <AssinaturaAdmin />
          </RotaProtegida>,
        )}
      />
      <Route
        path="/admin/painel"
        element={comSuspense(
          <RotaProtegida>
            <PainelAdmin />
          </RotaProtegida>,
        )}
      />
      <Route
        path="/admin/painel/cadastro"
        element={comSuspense(
          <RotaProtegida>
            <AtualizarCadastroAdmin />
          </RotaProtegida>,
        )}
      />
      <Route
        path="/admin/painel/montagens"
        element={comSuspense(
          <RotaProtegida>
            <HistoricoMontagensAdmin />
          </RotaProtegida>,
        )}
      />
      <Route
        path="/admin/painel/categorias/novo"
        element={comSuspense(
          <RotaProtegida>
            <FormularioCategoria />
          </RotaProtegida>,
        )}
      />
      <Route
        path="/admin/painel/categorias/:categoriaId"
        element={comSuspense(
          <RotaProtegida>
            <CategoriaPainel />
          </RotaProtegida>,
        )}
      />
      <Route
        path="/admin/painel/categorias/:categoriaId/itens/novo"
        element={comSuspense(
          <RotaProtegida>
            <FormularioItem />
          </RotaProtegida>,
        )}
      />
      <Route
        path="/admin/painel/categorias/:categoriaId/itens/:itemId"
        element={comSuspense(
          <RotaProtegida>
            <FormularioItem />
          </RotaProtegida>,
        )}
      />
      <Route path="/c/:slug" element={<RedirectCSlug />} />
      <Route path="/:slug" element={<PaginaCliente />} />
      <Route path="*" element={<Navigate to="/raffiner" replace />} />
    </Routes>
  )
}
