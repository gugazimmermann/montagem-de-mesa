# Montagem de Mesa

Aplicação web (React + Vite + TypeScript) para **montar uma composição de mesa** escolhendo peças por categoria e vendo a **pré-visualização** conforme você seleciona.

Suporta **vários clientes**: cada um tem login no admin (Supabase Auth), nome/logo próprios e categorias editáveis. Autenticação e catálogo ficam no **Supabase** (PostgreSQL + RLS). Toalhas fixas continuam em JSON local.

## Pré-requisitos

- Node.js + npm
- Projeto no [Supabase](https://supabase.com)

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Copie [`.env.example`](.env.example) para `.env` e preencha:
   - `VITE_SUPABASE_URL` — Project URL (Settings → API), no formato `https://....supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — chave `anon` `public`
   - `SUPABASE_SERVICE_ROLE_KEY` — service role (só local / seed; nunca no frontend)
   - `DATABASE_URL` — connection string URI (Settings → Database), opcional se preferir rodar o SQL no Editor
3. Aplique o schema + RLS de uma destas formas:
   - `npm run db:migrate` (usa `DATABASE_URL`), ou
   - cole o SQL de [`supabase/migrations/20260729120000_auth_catalogo.sql`](supabase/migrations/20260729120000_auth_catalogo.sql) no SQL Editor
4. Rode o seed (uma vez):

```bash
npm run seed:supabase
```

O script lê o `.env` automaticamente. Cria o usuário Auth, o cliente `raffiner` e importa [`src/dados/catalogo.json`](src/dados/catalogo.json).

Credenciais seed padrão: e-mail `admin@raffiner.com` / senha `admin123` (altere via `SEED_EMAIL` / `SEED_PASSWORD` no `.env`).

## Como rodar

```bash
npm install
cp .env.example .env   # preencha as chaves
npm run db:migrate     # ou rode o SQL no Editor
npm run seed:supabase
npm run dev
```

Abra a URL exibida no terminal (geralmente `http://localhost:5173`).

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Redireciona para `/c/raffiner` |
| `/c/:slug` | Montagem pública do cliente |
| `/admin` ou `/entrar` | Login (Supabase Auth) |
| `/admin/painel` | Painel (nome, logo, CRUD de categorias) |

## Auth e proteção

- Senhas só no Supabase Auth (hash bcrypt); nunca no bundle.
- Sessão JWT gerenciada por `@supabase/supabase-js` (refresh automático).
- Rate limit de login nativo do Auth.
- **RLS** no Postgres: leitura pública da montagem; writes só com `auth.uid()` dono do cliente.
- `RotaProtegida` exige sessão válida + registro em `clientes`.

## Dados e persistência

| Recurso | Onde |
|---------|------|
| Usuários / senhas | Supabase Auth |
| Perfil do cliente (`clientes`) | PostgreSQL |
| Categorias e itens editáveis | PostgreSQL |
| Toalhas fixas | [`src/dados/toalhas.json`](src/dados/toalhas.json) (merge no cliente; não editáveis no painel) |
| Seed do catálogo Raffiner | [`src/dados/catalogo.json`](src/dados/catalogo.json) → importado pelo seed |

Para outro cliente: crie o usuário no Auth (Dashboard ou Admin API), insira uma row em `clientes` com `auth_user_id`, e use o painel para montar o catálogo. As toalhas já entram automaticamente.

## Deploy no Render (Static Site)

| Campo | Valor |
|-------|-------|
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

Variáveis de ambiente no serviço (necessárias no **build**):

| Key | Valor |
|-----|--------|
| `VITE_SUPABASE_URL` | URL do projeto |
| `VITE_SUPABASE_ANON_KEY` | chave `anon` |

Não coloque a service role nem `DATABASE_URL` no Render.

Como é uma SPA com rotas (`/admin`, `/c/*`), é **obrigatório** um rewrite para `index.html`:

| Source | Destination | Action |
|--------|-------------|--------|
| `/*` | `/index.html` | **Rewrite** |

O arquivo [`render.yaml`](render.yaml) já declara rewrite e placeholders de env para Blueprint.

## Scripts úteis

- `npm run dev` — desenvolvimento com hot reload
- `npm run build` — build de produção (`dist/`)
- `npm run preview` — pré-visualiza o build localmente
- `npm run lint` — roda o oxlint
- `npm run db:migrate` — aplica a migration SQL via `DATABASE_URL`
- `npm run seed:supabase` — seed Auth + cliente + catálogo (service role)

## Estrutura

- `src/aplicacao/` — rotas e tela pública da montagem
- `src/dados/` — cliente Supabase, repositório e JSON de toalhas/seed
- `src/funcionalidades/admin/` — login e painel
- `src/funcionalidades/autenticacao/` — AuthProvider + rota protegida
- `src/funcionalidades/catalogo/` — helpers do catálogo
- `src/funcionalidades/mesa/` — seletor e pré-visualização
- `supabase/migrations/` — schema e RLS
- `scripts/apply-migration.mjs` — aplica a migration via Postgres
- `scripts/seed-supabase.mjs` — seed one-shot

## Regras do app

- Lugar americano e sousplat são **mutuamente exclusivos** quando ambas as categorias existem (ids `lugarAmericano` e `sousplat`).
