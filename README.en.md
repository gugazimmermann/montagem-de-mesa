# Montagem de Mesa

[Português](README.md) | **English**

![Example table-setting preview](public/readme/readme.png)

Multi-tenant web app for table-setting stores: visitors pick pieces by category, see a live preview, and submit the composition; shop owners manage catalog, leads, and subscription.

Each account has admin login, name, logo, public URL (`/:slug`), and an editable catalog. Auth, data, and images live on **Supabase** (Auth + PostgreSQL + Storage + RLS). Fixed tablecloths come from local JSON (not editable in the panel). **14-day trial**; without active access, both the admin panel and the public page are blocked.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19 · Vite 8 · TypeScript · Tailwind 4 · React Router 7 · TanStack Query |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions) |
| Billing | Stripe (Checkout, Customer Portal, webhooks) |
| Email | Resend (notification when a composition is submitted) |
| Host | Render (Static Site) |

## Prerequisites

- Node.js + npm
- A [Supabase](https://supabase.com) project
- Your own SMTP is recommended (e.g. [Resend](https://resend.com)) — Supabase’s default email is for testing only
- A [Stripe](https://stripe.com) account (test mode for development)

## Quick start

```bash
npm install
cp .env.example .env          # fill in the keys (see below)
npm run db:migrate            # this app’s schema (does not reset the Database)
npm run seed:supabase         # Auth + demo client + catalog + imagens/
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`). `/` is the landing page; the demo lives at `/raffiner`.

## Environment variables

Copy [`.env.example`](.env.example) and fill it in. Keep frontend, local scripts, and Edge Function secrets clearly separated.

### Frontend (Vite / Render)

| Variable | Use |
|----------|-----|
| `VITE_SUPABASE_URL` | Project URL (`https://….supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | `anon` `public` key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional (`pk_test_…`); redirect Checkout does not require it |

### Local scripts (never in Vite / Render)

| Variable | Use |
|----------|-----|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — only for `npm run seed:supabase` |
| `DATABASE_URL` | Postgres URI — `npm run db:migrate` (and transactional seed) |
| `SEED_EMAIL` | Optional; default `financeiroraffiner@gmail.com` |
| `SEED_PASSWORD` | Required for seed (min. 10 characters) |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `false` only if local SSL CA verification fails |

### Edge Function secrets

Supabase Dashboard → Edge Functions → Secrets (or `supabase secrets set`):

| Secret | Use |
|--------|-----|
| `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook endpoint |
| `STRIPE_PRICE_ID` | `price_…` for the monthly plan |
| `SITE_URL` | App origin (`http://localhost:5173` or production domain) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Sender (e.g. `Montagem de Mesa <onboarding@resend.dev>` for tests) |

## Supabase

### Auth (URL Configuration)

Under **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` (production domain in production)
- **Redirect URLs:**
  - `http://localhost:5173/admin`
  - `http://localhost:5173/admin/redefinir-senha`
  - `http://localhost:5173/admin/painel/cadastro`

Signup confirmation → `/admin`; password reset → `/admin/redefinir-senha`; email change → `/admin/painel/cadastro`.

### Security checklist

1. **Authentication → Providers → Email** — require email confirmation; minimum password length **10**; prefer Secure password change.
2. Redirect URLs only for your domain.
3. Bot protection / Auth rate limits when available.
4. Catalog and Storage are publicly readable only while subscription/trial is active (`cliente_tem_acesso`).

### Schema and migrations

```bash
npm run db:migrate
```

Applies files in [`supabase/migrations/`](supabase/migrations/) (lexicographic order): schema, trial/subscription, optimizations, insert/URL protection, and CRM with soft-delete.

Does not reset the project Database. Without `DATABASE_URL`: `supabase db query --linked -f supabase/migrations/FILE.sql`.

### Edge Functions

| Function | Role |
|----------|------|
| `criar-checkout` | Subscription Checkout Session |
| `criar-portal` | Customer Portal (card / invoices) |
| `cancelar-assinatura` | Cancel at period end |
| `listar-faturas` | Invoice history (+ sync if needed) |
| `sincronizar-assinatura` | Stripe → `clientes` |
| `stripe-webhook` | Stripe events → `clientes` (`verify_jwt` off) |
| `enviar-montagem` | Visitor submits composition + email via Resend (`verify_jwt` off) |

Deploy (CLI linked to the project):

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

`supabase/config.toml` sets `verify_jwt` per function.

## Stripe

1. Account at [dashboard.stripe.com](https://dashboard.stripe.com) with **Test mode**.
2. Recurring monthly Product + Price → `STRIPE_PRICE_ID`.
3. API keys → `STRIPE_SECRET_KEY` (publishable key optional on the frontend).
4. Customer Portal: enable card updates, cancel, and invoices.
5. Webhook → `https://<PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.  
   Signing secret → `STRIPE_WEBHOOK_SECRET`.
6. Test card: `4242 4242 4242 4242` ([docs](https://docs.stripe.com/testing)).

UI: [`/admin/assinatura`](src/funcionalidades/admin/AssinaturaAdmin.tsx) — trial/active, Subscribe, Manage billing, Cancel at period end, invoices.

## Resend (submit composition)

On the public page (`/:slug`), the visitor submits name, email, WhatsApp, and address. The `enviar-montagem` function emails the shop admin and the app opens the shop’s WhatsApp.

1. API key at [resend.com](https://resend.com) → `RESEND_API_KEY`.
2. For tests, `RESEND_FROM` may use `onboarding@resend.dev`. In production, use a verified domain.
3. Set WhatsApp under `/admin/painel/cadastro`.
4. History and lead CRM: `/admin/painel/montagens`.

## Seed and images

```bash
npm run seed:supabase
```

Requires `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SEED_PASSWORD`:

- creates/updates the Auth user
- recreates the **Raffiner** client (`slug=raffiner`) on trial (14 days)
- imports [`src/dados/catalogo.json`](src/dados/catalogo.json)
- uploads logo and photos from [`imagens/`](imagens/) to Storage
- updates URLs in the database (does not rewrite local JSON)

Expected layout:

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

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing |
| `/:slug` | Public composer (submit composition) |
| `/c/:slug` | Legacy redirect → `/:slug` |
| `/admin`, `/entrar` | Login |
| `/cadastro` | Sign up |
| `/admin/recuperar-senha` | Request password reset |
| `/admin/redefinir-senha` | New password (after email link) |
| `/admin/assinatura` | Trial, Checkout, Portal, invoices |
| `/admin/painel` | Catalog (categories and items) + onboarding/help |
| `/admin/painel/cadastro` | Name, address, email, logo, and WhatsApp |
| `/admin/painel/montagens` | History and lead CRM |
| `/admin/painel/categorias/...` | Category and item CRUD |

## Data model

| Resource | Where |
|----------|-------|
| Users / passwords | Supabase Auth |
| Client (`clientes`) | Postgres — UUID, `slug`, `auth_user_id`, Stripe/trial |
| Submitted compositions | `montagens_enviadas` — insert via Edge Function; CRM (`lead_status`, `nota_interna`) |
| Categories and items | Postgres — UUID; RLS with `cliente_tem_acesso` |
| Logos / photos | Storage (`logos`, `itens`); local source in `imagens/` |
| Fixed tablecloths | [`src/dados/toalhas.json`](src/dados/toalhas.json) |
| Subscription | Stripe via Edge Functions |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Preview the build |
| `npm run lint` | oxlint |
| `npm run test` | Vitest (once) |
| `npm run test:watch` | Vitest watch mode |
| `npm run db:migrate` | Apply migrations via `DATABASE_URL` |
| `npm run seed:supabase` | Auth + client + catalog + upload from `imagens/` |

## Repository structure

```
src/aplicacao/              # routes, landing, public page
src/dados/                  # Supabase client, repositories, JSON
src/compartilhado/          # types, utils, ErrorBoundary
src/funcionalidades/
  admin/                    # login, panel, profile, subscription, help
  autenticacao/             # AuthProvider, protected route
  catalogo/                 # catalog helpers
  mesa/                     # selector, preview, submit composition
imagens/                    # local assets (seed → Storage)
public/ajuda/               # admin help examples
supabase/migrations/        # schema, RLS, storage, trial, CRM
supabase/functions/         # Stripe + enviar-montagem
scripts/                    # migrate, seed, spa-fallback
render.yaml                 # Static Site deploy
```

## Deploy (Render)

| Field | Value |
|-------|--------|
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Build** env: only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never put the service role or `DATABASE_URL` on Render.

SPA: rewrite `/*` → `/index.html` (already in [`render.yaml`](render.yaml)).

After deploy: update Auth Site URL and Redirect URLs; publish Edge Functions and secrets; point the Stripe webhook at the production project.

## App conventions

- Seed categories use a stable `codigo` (`sousplat`, `pratoRaso`, …) for the preview; the primary key is a UUID.
- Admin-created categories without `codigo` render as a generic preview layer (if they have an image).
- Code folders and routes are in Portuguese; the admin UI is Portuguese as well.
