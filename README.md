# Montagem de Mesa

Aplicação web para **montar uma composição de mesa**: o visitante escolhe peças por categoria e vê a **pré-visualização** em tempo real.

Multi-cliente: cada conta tem login no admin, nome, logo, endereço público e catálogo editável. Auth, dados e imagens no **Supabase** (Auth + PostgreSQL + Storage + RLS). Toalhas fixas vêm de JSON local (não editáveis no painel).

**Stack:** React 19 · Vite · TypeScript · React Router · `@supabase/supabase-js`

## Quick start

```bash
npm install
cp .env.example .env          # preencha as chaves (veja Configuração)
# aplique as migrations na ordem da seção Schema
npm run seed:supabase
npm run dev
```

Abra a URL do Vite (em geral `http://localhost:5173`). Detalhes de Auth, SMTP e SQL estão abaixo.

## Pré-requisitos

- Node.js + npm
- Projeto no [Supabase](https://supabase.com)
- SMTP próprio recomendado (ex.: [Resend](https://resend.com)) — o e-mail padrão do Supabase é só para testes e tem limite baixo

## Configuração

### Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | Project URL (`https://….supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Chave `anon` `public` (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — **só** scripts locais (seed/upload); nunca no Vite/Render |
| `DATABASE_URL` | URI do Postgres — opcional; necessário para `npm run db:migrate` |
| `SEED_EMAIL` / `SEED_PASSWORD` | Opcional; padrão do seed: `admin@raffiner.com` / `admin123` |

### Auth (URL Configuration)

Em **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` (em produção, o domínio do site)
- **Redirect URLs:**
  - `http://localhost:5173/admin`
  - `http://localhost:5173/admin/redefinir-senha`
  - `http://localhost:5173/admin/painel/cadastro`

(confirmação de cadastro → `/admin`; reset de senha → `/admin/redefinir-senha`; troca de e-mail → `/admin/painel/cadastro`)

Com **Secure email change** ativo (**Auth → Providers → Email**), a troca de e-mail exige confirmar **dois** links (atual e novo). Para um único link no endereço novo, desative essa opção.

### Schema e RLS

Ordem (instalação nova), via SQL Editor ou `npm run db:migrate -- <arquivo>`:

1. [`supabase/migrations/20260729120000_auth_catalogo.sql`](supabase/migrations/20260729120000_auth_catalogo.sql) — tabelas com IDs **UUID**, RLS
2. [`supabase/migrations/20260910200000_storage_itens.sql`](supabase/migrations/20260910200000_storage_itens.sql)
3. [`supabase/migrations/20260910210000_storage_logos.sql`](supabase/migrations/20260910210000_storage_logos.sql)
4. [`supabase/migrations/20260910220000_clientes_insert.sql`](supabase/migrations/20260910220000_clientes_insert.sql)

Projeto antigo com IDs em `text`: aplique também [`20260911150000_ids_uuid.sql`](supabase/migrations/20260911150000_ids_uuid.sql) (**destrutiva** — apaga clientes/categorias/itens) e rode o seed de novo.

### Seed e imagens

```bash
npm run seed:supabase
```

Cria o usuário Auth (se ainda não existir), o cliente com endereço público `raffiner` (UUID gerado) e importa [`src/dados/catalogo.json`](src/dados/catalogo.json).

Uploads opcionais (cliente pelo endereço `raffiner`, ou `UPLOAD_CLIENTE_ID` = UUID):

```bash
npm run upload:logo
npm run upload:imagens
```

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Redireciona para `/raffiner` |
| `/:slug` | Montagem pública (endereço do cliente) |
| `/admin`, `/entrar` | Login |
| `/cadastro` | Criar conta |
| `/admin/recuperar-senha` | Pedir reset de senha |
| `/admin/redefinir-senha` | Nova senha (após o link do e-mail) |
| `/admin/painel` | Painel (categorias e itens) |
| `/admin/painel/cadastro` | Atualizar nome, endereço, e-mail e logo |

## Dados

| Recurso | Onde |
|---------|------|
| Usuários / senhas | Supabase Auth |
| Cliente (`clientes`) | Postgres — `id` UUID; endereço público único (`slug`); `auth_user_id` |
| Categorias e itens | Postgres — IDs UUID; RLS: leitura pública, escrita do dono |
| Logos / fotos | Storage (`logos`, `itens`) |
| Toalhas fixas | [`src/dados/toalhas.json`](src/dados/toalhas.json) (merge no cliente) |

Novo cliente: cadastro em `/cadastro` (ou Auth + linha em `clientes` com `auth_user_id`) e catálogo no painel. Toalhas entram automaticamente.

## Scripts

| Comando | Função |
|---------|--------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção (`dist/`) |
| `npm run preview` | Preview do build |
| `npm run lint` | oxlint |
| `npm run db:migrate` | Aplica SQL via `DATABASE_URL` (arquivo opcional na CLI) |
| `npm run seed:supabase` | Seed Auth + cliente + catálogo |
| `npm run upload:logo` | Envia logo para Storage |
| `npm run upload:imagens` | Envia `public/imgs` e atualiza URLs |

## Estrutura

```
src/aplicacao/              # rotas e página pública
src/dados/                  # cliente Supabase, repositório, JSON
src/compartilhado/          # tipos e utils
src/funcionalidades/
  admin/                    # login, painel, cadastro, formulários
  autenticacao/             # AuthProvider, rota protegida
  catalogo/                 # helpers do catálogo
  mesa/                     # seletor e pré-visualização
supabase/migrations/        # schema, storage, RLS
scripts/                    # migrate, seed, uploads
```

## Deploy (Render — Static Site)

| Campo | Valor |
|-------|--------|
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

Env no **build:** apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Não use service role nem `DATABASE_URL` no Render.

SPA: rewrite `/*` → `/index.html` (já em [`render.yaml`](render.yaml)).

No Auth do Supabase, atualize **Site URL** e **Redirect URLs** para o domínio de produção (mesmo padrão das URLs de localhost).

## Regras do app

- Lugar americano e sousplat são **mutuamente exclusivos** quando as duas categorias existem (ids `lugarAmericano` e `sousplat`).
