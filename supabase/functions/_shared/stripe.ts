import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

export function stripeClient(): Stripe {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) throw new Error('STRIPE_SECRET_KEY não configurada')
  return new Stripe(key, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export function siteUrl(): string {
  const url = Deno.env.get('SITE_URL')?.replace(/\/$/, '')
  if (!url) throw new Error('SITE_URL não configurada')
  return url
}

export function priceId(): string {
  const id = Deno.env.get('STRIPE_PRICE_ID')
  if (!id) throw new Error('STRIPE_PRICE_ID não configurada')
  return id
}
