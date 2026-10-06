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

function customerInexistente(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: string; type?: string; message?: string }
  if (e.code === 'resource_missing') return true
  return (e.message ?? '').toLowerCase().includes('no such customer')
}

/** Retorna um customer utilizável; recria se o ID do banco estiver deletado/inexistente. */
export async function garantirCustomerStripe(
  stripe: Stripe,
  existenteId: string | null,
  dados: { email: string; nome: string; clienteId: string },
): Promise<{ customerId: string; precisouSalvar: boolean }> {
  if (existenteId) {
    try {
      const customer = await stripe.customers.retrieve(existenteId)
      if (!('deleted' in customer && customer.deleted)) {
        return { customerId: customer.id, precisouSalvar: false }
      }
    } catch (err) {
      if (!customerInexistente(err)) throw err
      console.warn('stripe customer inválido, recriando', existenteId)
    }
  }

  const customer = await stripe.customers.create({
    email: dados.email,
    name: dados.nome,
    metadata: { cliente_id: dados.clienteId },
  })
  return { customerId: customer.id, precisouSalvar: true }
}
