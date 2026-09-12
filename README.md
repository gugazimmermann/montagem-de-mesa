# Montagem de Mesa

Aplicação web para **montar uma composição de mesa**: o visitante escolhe peças por categoria e vê a **pré-visualização** em tempo real.

Multi-cliente: cada conta tem login no admin, nome, logo, endereço público e catálogo editável. Auth, dados e imagens no **Supabase** (Auth + PostgreSQL + Storage + RLS). Toalhas fixas vêm de JSON local (não editáveis no painel).

**Stack:** React 19 · Vite · TypeScript · React Router · `@supabase/supabase-js`

## Quick start

```bash
npm install
cp .env.example .env          # preencha as chaves (veja Configuração)
npm run db:migrate            # schema deste app (não reseta o Database)
npm run seed:supabase         # Auth + cliente + catálogo + imagens/
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
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — **só** scripts locais (seed); nunca no Vite/Render |
| `DATABASE_URL` | URI do Postgres — necessário para `npm run db:migrate` (e seed transacional) |
| `SEED_EMAIL` | Opcional; padrão `gugazimmermann@gmail.com` |
| `SEED_PASSWORD` | Opcional; padrão `1234567890` (mín. 8 no script; o app exige 10) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Opcional (`pk_test_…`); Checkout por redirect não exige |

**Secrets das Edge Functions** (Supabase Dashboard → Edge Functions → Secrets; nunca no Vite):

| Secret | Uso |
|--------|-----|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` do endpoint de webhook |
| `STRIPE_PRICE_ID` | `price_…` do plano mensal |
| `SITE_URL` | Origem do app (`http://localhost:5173` ou domínio de produção) |

### Auth (URL Configuration)

Em **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` (em produção, o domínio do site)
- **Redirect URLs:**
  - `http://localhost:5173/admin`
  - `http://localhost:5173/admin/redefinir-senha`
  - `http://localhost:5173/admin/painel/cadastro`

(confirmação de cadastro → `/admin`; reset de senha → `/admin/redefinir-senha`; troca de e-mail → `/admin/painel/cadastro`)

Com **Secure email change** desativado (**Auth → Providers → Email**), a troca de e-mail exige só confirmar o link no endereço **novo** (comportamento esperado pelo app). Se ativar Secure email change, o Supabase passa a exigir também o link no e-mail atual.

### Checklist de segurança (Auth / projeto)

No dashboard Supabase:

1. **Authentication → Providers → Email**
   - Confirmação de e-mail **obrigatória** (signup aberto multi-tenant).
   - Política de senha: mínimo **10** caracteres (alinhar com o app).
   - Preferir **Secure password change** / fluxo que force redefinição após recovery (o app também bloqueia o painel com flag em `localStorage` até `updateUser({ password })`).
2. **Authentication → URL Configuration** — só Redirect URLs do seu domínio (ver acima).
3. **Bot protection** / rate limits no Auth quando disponível.
4. Catálogo e Storage de itens/logos são **leitura pública** quando o cliente tem assinatura/trial ativos (`cliente_tem_acesso`). Sem acesso, a montagem pública some da view `clientes_publicos` e das policies.
5. `npm run db:migrate` usa `ssl: { rejectUnauthorized: false }`; prefira CA válida em `DATABASE_URL` quando possível.

### Schema e RLS

```bash
npm run db:migrate
```

Aplica, em ordem, os arquivos em [`supabase/migrations/`](supabase/migrations/):

1. [`20260911180000_schema.sql`](supabase/migrations/20260911180000_schema.sql) — drop **só** de `clientes` / `categorias` / `itens` (+ funções/policies/views deste app) e recria o schema final (UUID, RLS, `codigo`, view pública sem e-mail, lock de colunas sensíveis)
2. [`20260911180001_storage.sql`](supabase/migrations/20260911180001_storage.sql) — buckets `itens` / `logos` e policies
3. [`20260912000000_assinatura_stripe.sql`](supabase/migrations/20260912000000_assinatura_stripe.sql) — trial/Stripe em `clientes`, `cliente_tem_acesso`, RLS e view só com assinatura/trial ativos

**Não** reseta o Database do projeto. Tabelas de outros apps (ex.: `leads`) permanecem intactas. Opcional: `npm run db:migrate -- caminho/arquivo.sql` para um arquivo só.

### Assinatura Stripe (trial + bloqueio total)

Cada loja (`clientes`) ganha **14 dias de trial** no cadastro. Sem acesso ativo, o painel e a página pública `/:slug` ficam bloqueados.

Cobrança via **Stripe Checkout** + **Customer Portal**. O estado no Postgres é atualizado pelo webhook e, se o webhook atrasar, pela function `sincronizar-assinatura` (chamada ao voltar do checkout e ao abrir `/admin/assinatura`).

Edge Functions em [`supabase/functions/`](supabase/functions/):

| Function | Papel |
|----------|--------|
| `criar-checkout` | Checkout Session de assinatura |
| `criar-portal` | Customer Portal (cartão / faturas) |
| `cancelar-assinatura` | Cancela no fim do período (`cancel_at_period_end`) |
| `listar-faturas` | Histórico de faturas pagas (+ sync se DB defasado) |
| `sincronizar-assinatura` | Stripe → `clientes` (status, subscription id, período) |
| `stripe-webhook` | Eventos Stripe → atualiza `clientes` (`verify_jwt` desligado) |

#### Criar conta Stripe e obter os dados

1. **Conta + Test mode** — registre-se em [dashboard.stripe.com/register](https://dashboard.stripe.com/register). Deixe **Test mode** ligado (cobrança com cartões de teste; KYC só é obrigatório no Live).
2. **Product + Price** — Product catalog → Products → Add product. Nome ex. `Montagem de Mesa`. Pricing: **Recurring**, **Monthly**, moeda (ex. BRL) e valor. Copie o **Price ID** (`price_…`) → secret `STRIPE_PRICE_ID`.
3. **API keys** — Developers → API keys. Copie **Secret key** (`sk_test_…`) → `STRIPE_SECRET_KEY`. Publishable (`pk_test_…`) é opcional no app.
4. **Customer Portal** — Settings → Billing → Customer portal: ative atualizar cartão, cancelar e ver faturas.
5. **Secrets + deploy das functions** (com [Supabase CLI](https://supabase.com/docs/guides/cli) linkado ao projeto):

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_ID=price_... \
  SITE_URL=http://localhost:5173

supabase functions deploy criar-checkout
supabase functions deploy criar-portal
supabase functions deploy cancelar-assinatura
supabase functions deploy listar-faturas
supabase functions deploy sincronizar-assinatura
supabase functions deploy stripe-webhook --no-verify-jwt
```

`supabase/config.toml` define `verify_jwt` por function (webhook = `false`).

6. **Webhook** — Developers → Webhooks → Add endpoint  
   `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`  
   Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.  
   Copie o **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` (rode `supabase secrets set` de novo se precisar).
7. **Cartão de teste** — `4242 4242 4242 4242`, validade futura, CVC qualquer ([docs](https://docs.stripe.com/testing)).

UI: [`/admin/assinatura`](src/funcionalidades/admin/AssinaturaAdmin.tsx) — status (trial ou ativa), Assinar, Gerenciar cobrança, Cancelar no fim do período, histórico de faturas em pt-BR. No painel, o menu fica: Ver montagem → Atualizar cadastro → Assinatura → Sair.

O seed Raffiner entra com `subscription_status=active` para demos locais.

### Seed e imagens

```bash
npm run seed:supabase
```

One-shot (precisa de `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):

- cria/atualiza o usuário Auth
- recria o cliente **Raffiner** (`slug=raffiner`)
- importa [`src/dados/catalogo.json`](src/dados/catalogo.json)
- envia logo e fotos de [`imagens/`](imagens/) para o Storage
- atualiza as URLs no banco e no JSON

**Não apaga** os arquivos locais em `imagens/`. Layout esperado:

```
imagens/logos/raffiner.webp
imagens/itens/raffiner/
  Sousplat/
  Pratos Rasos/
  Pratos Fundos/
  Pratos de sobremesa/
  Porta Guardanapos/
  Tacas/
```

Defaults: e-mail `gugazimmermann@gmail.com`, senha `1234567890`. Com `DATABASE_URL`, o catálogo é gravado em transação SQL.

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Redireciona para `/raffiner` |
| `/:slug` | Montagem pública (endereço do cliente) |
| `/admin`, `/entrar` | Login |
| `/cadastro` | Criar conta |
| `/admin/recuperar-senha` | Pedir reset de senha |
| `/admin/redefinir-senha` | Nova senha (após o link do e-mail) |
| `/admin/painel` | Painel (categorias e itens) — exige trial/assinatura ativos |
| `/admin/painel/cadastro` | Atualizar nome, endereço, e-mail e logo |
| `/admin/assinatura` | Status do trial/assinatura, Checkout, Portal, cancelamento e histórico de faturas |

## Dados

| Recurso | Onde |
|---------|------|
| Usuários / senhas | Supabase Auth |
| Cliente (`clientes`) | Postgres — `id` UUID; endereço público único (`slug`); `auth_user_id`; campos Stripe/trial |
| Categorias e itens | Postgres — IDs UUID; RLS: leitura/escrita só com `cliente_tem_acesso` + dono na escrita |
| Logos / fotos | Storage (`logos`, `itens`); fonte local em `imagens/` |
| Toalhas fixas | [`src/dados/toalhas.json`](src/dados/toalhas.json) (merge no cliente) |
| Assinatura | Stripe via Edge Functions (`criar-checkout`, `criar-portal`, `cancelar-assinatura`, `listar-faturas`, `sincronizar-assinatura`, `stripe-webhook`) |

Novo cliente: cadastro em `/cadastro` (ou Auth + linha em `clientes` com `auth_user_id`) e catálogo no painel. Toalhas entram automaticamente.

## Scripts

| Comando | Função |
|---------|--------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção (`dist/`) |
| `npm run preview` | Preview do build |
| `npm run lint` | oxlint |
| `npm run db:migrate` | Aplica todas as migrations via `DATABASE_URL` |
| `npm run seed:supabase` | Auth + cliente + catálogo + upload de `imagens/` |

## Estrutura

```
src/aplicacao/              # rotas e página pública
src/dados/                  # cliente Supabase, repositório, JSON
src/compartilhado/          # tipos, utils, ErrorBoundary, ImagemAmpliada
src/funcionalidades/
  admin/                    # login, painel, cadastro, formulários
  autenticacao/             # AuthProvider, rota protegida
  catalogo/                 # helpers do catálogo
  mesa/                     # seletor e pré-visualização
imagens/                    # logo e fotos locais (seed → Storage)
supabase/migrations/        # schema + storage + assinatura
supabase/functions/         # Edge Functions Stripe (checkout, portal, sync, webhook)
supabase/config.toml        # verify_jwt das functions
scripts/                    # migrate, seed
scripts/lib/                # env, mime, cliente admin compartilhados
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

- Categorias do seed usam `codigo` estável (`sousplat`, `pratoRaso`, …) para o preview; o PK é UUID.
- Categorias criadas no admin sem `codigo` aparecem no preview como camada genérica (se tiverem imagem).
