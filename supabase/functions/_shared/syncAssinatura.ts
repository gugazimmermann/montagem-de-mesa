import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { stripeClient } from './stripe.ts'
import { supabaseAdmin, type ClienteBilling } from './supabase.ts'

export type StatusAssinatura =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'

export type PatchAssinatura = {
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  subscription_status: StatusAssinatura
  current_period_end: string | null
}

export type ResumoAssinaturaStripe = {
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
}

const PRIORIDADE: Record<string, number> = {
  active: 100,
  past_due: 90,
  trialing: 80,
  unpaid: 50,
  incomplete: 40,
  paused: 30,
  canceled: 10,
  incomplete_expired: 5,
}

export function mapStatusStripe(
  status: Stripe.Subscription.Status,
): StatusAssinatura {
  switch (status) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
      return 'canceled'
    case 'unpaid':
      return 'unpaid'
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
    default:
      return status === 'paused' ? 'canceled' : 'incomplete'
  }
}

export function periodEndIso(subscription: Stripe.Subscription): string | null {
  return subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null
}

export function escolherMelhorSubscription(
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  if (subscriptions.length === 0) return null
  return [...subscriptions].sort((a, b) => {
    const pa = PRIORIDADE[a.status] ?? 0
    const pb = PRIORIDADE[b.status] ?? 0
    if (pb !== pa) return pb - pa
    return (b.created ?? 0) - (a.created ?? 0)
  })[0]!
}

export async function aplicarSubscriptionNoCliente(
  clienteId: string,
  subscription: Stripe.Subscription,
): Promise<PatchAssinatura> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null

  const patch: PatchAssinatura = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    subscription_status: mapStatusStripe(subscription.status),
    current_period_end: periodEndIso(subscription),
  }

  const admin = supabaseAdmin()
  const { error } = await admin.from('clientes').update(patch).eq('id', clienteId)
  if (error) throw error
  return patch
}

export function resumoDeSubscription(
  subscription: Stripe.Subscription,
): ResumoAssinaturaStripe {
  return {
    status: subscription.status,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEnd: periodEndIso(subscription),
  }
}

/** Busca assinaturas no Stripe e atualiza o cliente no Postgres. */
export async function sincronizarClienteComStripe(cliente: ClienteBilling): Promise<{
  synced: boolean
  patch: PatchAssinatura | null
  assinatura: ResumoAssinaturaStripe | null
}> {
  if (!cliente.stripe_customer_id) {
    return { synced: false, patch: null, assinatura: null }
  }

  const stripe = stripeClient()
  const lista = await stripe.subscriptions.list({
    customer: cliente.stripe_customer_id,
    status: 'all',
    limit: 10,
  })

  const melhor = escolherMelhorSubscription(lista.data)
  if (!melhor) {
    return { synced: false, patch: null, assinatura: null }
  }

  const patch = await aplicarSubscriptionNoCliente(cliente.id, melhor)
  return {
    synced: true,
    patch,
    assinatura: resumoDeSubscription(melhor),
  }
}
