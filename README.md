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

Abra a URL do Vite (em geral `http://localhost:5173`). A raiz `/` é a landing; a demo fica em `/raffiner`. Detalhes de Auth, SMTP e SQL estão abaixo.

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
| `SEED_EMAIL` | Opcional; padrão `financeiroraffiner@gmail.com` |
| `SEED_PASSWORD` | Obrigatório para o seed (mín. 10 caracteres, igual ao app) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Opcional (`pk_test_…`); Checkout por redirect não exige |

**Secrets das Edge Functions** (Supabase Dashboard → Edge Functions → Secrets; nunca no Vite):

| Secret | Uso |
|--------|-----|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` do endpoint de webhook |
| `STRIPE_PRICE_ID` | `price_…` do plano mensal |
| `SITE_URL` | Origem do app (`http://localhost:5173` ou domínio de produção) |
| `RESEND_API_KEY` | API key do [Resend](https://resend.com) — e-mail ao admin ao enviar montagem |
| `RESEND_FROM` | Remetente (ex.: `Montagem de Mesa <onboarding@resend.dev>` em testes; domínio verificado em produção) |

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
   - Preferir **Secure password change**. O app bloqueia o painel após recovery com flag em `localStorage` **e** `user_metadata.precisa_redefinir_senha` (sobrevive se a flag local for limpa) até `updateUser({ password })`.
2. **Authentication → URL Configuration** — só Redirect URLs do seu domínio (ver acima).
3. **Bot protection** / rate limits no Auth quando disponível.
4. Catálogo e Storage de itens/logos são **leitura pública** quando o cliente tem assinatura/trial ativos (`cliente_tem_acesso`). Sem acesso, a montagem pública some da view `clientes_publicos` e das policies.
5. `npm run db:migrate` verifica o certificado SSL por padrão; use `DATABASE_SSL_REJECT_UNAUTHORIZED=false` só se necessário em ambiente local.

### Schema e RLS

```bash
npm run db:migrate
```

Aplica o schema em [`supabase/migrations/`](supabase/migrations/) (ordem lexicográfica), incluindo:

1. [`20260914140000_schema.sql`](supabase/migrations/20260914140000_schema.sql) — schema completo (tabelas, trial/assinatura, RLS, storage)
2. [`20260914150000_acesso_periodo.sql`](supabase/migrations/20260914150000_acesso_periodo.sql) — `current_period_end` no acesso, RPC `status_cliente_publico`, RLS de montagens com acesso
3. [`20260914160000_otimizacoes.sql`](supabase/migrations/20260914160000_otimizacoes.sql) — rate limit, catálogo público em RPC, storage privado, `email_status`/idempotência
4. [`20260914170000_proteger_insert_e_urls.sql`](supabase/migrations/20260914170000_proteger_insert_e_urls.sql) — proteção de colunas sensíveis no INSERT e URLs de storage
5. [`20260914180000_crm_soft_delete.sql`](supabase/migrations/20260914180000_crm_soft_delete.sql) — CRM de leads (`lead_status`/`nota_interna`), soft-delete de catálogo, reordenação

**Não** reseta o Database do projeto. Tabelas de outros apps (ex.: `leads`) permanecem intactas. Alternativa sem `DATABASE_URL`: `supabase db query --linked -f supabase/migrations/ARQUIVO.sql`.

`npm run db:migrate` usa SSL com verificação de certificado por padrão. Em ambientes locais sem CA, defina `DATABASE_SSL_REJECT_UNAUTHORIZED=false`.

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
| `enviar-montagem` | Visitante envia montagem → salva em `montagens_enviadas` + e-mail ao admin via Resend (`verify_jwt` desligado); admin autenticado pode `acao: reenviar` |

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
  SITE_URL=http://localhost:5173 \
  RESEND_API_KEY=re_... \
  RESEND_FROM='Montagem de Mesa <onboarding@resend.dev>'

supabase functions deploy criar-checkout
supabase functions deploy criar-portal
supabase functions deploy cancelar-assinatura
supabase functions deploy listar-faturas
supabase functions deploy sincronizar-assinatura
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy enviar-montagem --no-verify-jwt
```

`supabase/config.toml` define `verify_jwt` por function (webhook e enviar-montagem = `false`).

6. **Webhook** — Developers → Webhooks → Add endpoint  
   `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`  
   Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.  
   Copie o **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET` (rode `supabase secrets set` de novo se precisar).
7. **Cartão de teste** — `4242 4242 4242 4242`, validade futura, CVC qualquer ([docs](https://docs.stripe.com/testing)).

UI: [`/admin/assinatura`](src/funcionalidades/admin/AssinaturaAdmin.tsx) — status (trial ou ativa), Assinar, Gerenciar cobrança, Cancelar no fim do período, histórico de faturas em pt-BR. No painel, o menu fica: Ver montagem → Atualizar cadastro → Assinatura → Sair.

O seed Raffiner entra com `subscription_status=trialing` (14 dias).

#### Enviar montagem (visitante → admin)

Na montagem pública (`/:slug`), o visitante escolhe peças e usa **Enviar montagem**: preenche nome, e-mail, WhatsApp, endereço, cidade e estado. A Edge Function `enviar-montagem` localiza o e-mail do estabelecimento (sem expor no frontend) e envia via Resend; em seguida o app abre `wa.me` com a mensagem pronta para o WhatsApp cadastrado em **Atualizar cadastro**.

1. Crie API key em [resend.com](https://resend.com) → secret `RESEND_API_KEY`.
2. Em testes, `RESEND_FROM` pode ser `Montagem de Mesa <onboarding@resend.dev>` (só entrega para o e-mail da conta Resend). Em produção, verifique um domínio e use-o no `from`.
3. Deploy: `supabase functions deploy enviar-montagem --no-verify-jwt` (e `supabase secrets set` com as chaves Resend).
4. Cadastre o WhatsApp do estabelecimento em `/admin/painel/cadastro`.
5. Histórico no painel: `/admin/painel/montagens`.

### Seed e imagens

```bash
npm run seed:supabase
```

Precisa de `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + `SEED_PASSWORD`:

- cria/atualiza o usuário Auth
- recria o cliente **Raffiner** (`slug=raffiner`) em **trial** (14 dias)
- importa [`src/dados/catalogo.json`](src/dados/catalogo.json)
- envia logo e fotos de [`imagens/`](imagens/) para o Storage (`logos` / `itens`)
- atualiza as URLs no banco (não reescreve o JSON local)

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

Default de e-mail: `financeiroraffiner@gmail.com` (`SEED_EMAIL` sobrescreve). Com `DATABASE_URL`, o catálogo é gravado em transação SQL.

## Rotas

| Rota | Descrição |
|------|-----------|
| `/` | Redireciona para `/raffiner` |
| `/:slug` | Montagem pública; visitante pode enviar montagem (e-mail + WhatsApp) |
| `/admin`, `/entrar` | Login |
| `/cadastro` | Criar conta |
| `/admin/recuperar-senha` | Pedir reset de senha |
| `/admin/redefinir-senha` | Nova senha (após o link do e-mail) |
| `/admin/painel` | Painel (categorias e itens) — exige trial/assinatura ativos |
| `/admin/painel/cadastro` | Atualizar nome, endereço, e-mail, logo e WhatsApp |
| `/admin/painel/montagens` | Histórico de montagens enviadas por visitantes |
| `/admin/assinatura` | Status do trial/assinatura, Checkout, Portal, cancelamento e histórico de faturas |

## Dados

| Recurso | Onde |
|---------|------|
| Usuários / senhas | Supabase Auth |
| Cliente (`clientes`) | Postgres — `id` UUID; endereço público único (`slug`); `auth_user_id`; campos Stripe/trial |
| Montagens enviadas | Postgres — `montagens_enviadas`; insert via Edge Function; SELECT só do dono |
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
supabase/migrations/        # schema único (tabelas, RLS, storage, trial)
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
