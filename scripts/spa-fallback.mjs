import { cpSync, mkdirSync } from 'node:fs'

/** Rotas fixas que precisam de index.html físico no CDN (fallback sem rewrite). */
const rotas = [
  'admin',
  'entrar',
  'cadastro',
  'admin/painel',
  'admin/painel/cadastro',
  'admin/painel/categorias/novo',
  'admin/recuperar-senha',
  'admin/redefinir-senha',
  'raffiner',
]

for (const rota of rotas) {
  const dir = `dist/${rota}`
  mkdirSync(dir, { recursive: true })
  cpSync('dist/index.html', `${dir}/index.html`)
}
