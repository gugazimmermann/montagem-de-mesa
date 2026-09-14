import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { stripeClient } from '../_shared/stripe.ts'
import {
  aplicarSubscriptionNoCliente,
  mapStatusStripe,
  periodEndIso,
} from '../_shared/syncAssinatura.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

async function atualizarPorSubscription(subscription: Stripe.Subscription) {
  const clienteId = subscription.metadata?.cliente_id
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id

  if (clienteId) {
    await aplicarSubscriptionNoCliente(clienteId, subscription)
    return
  }

  if (customerId) {
    const admin = supabaseAdmin()
    const { error } = await admin
      .from('clientes')
      .update({
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        subscription_status: mapStatusStripe(subscription.status),
        current_period_end: periodEndIso(subscription),
      })
      .eq('stripe_customer_id', customerId)
    if (error) throw error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!webhookSecret) {
    return jsonResponse({ error: 'STRIPE_WEBHOOK_SECRET não configurada' }, 500)
  }

  const stripe = stripeClient()
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return jsonResponse({ error: 'Assinatura ausente' }, 400)
  }

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature', err)
    return jsonResponse({ error: 'Assinatura inválida' }, 400)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id
        const clienteId =
          session.metadata?.cliente_id ?? session.client_reference_id ?? null

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          if (clienteId && !subscription.metadata?.cliente_id) {
            await stripe.subscriptions.update(subscriptionId, {
              metadata: { ...subscription.metadata, cliente_id: clienteId },
            })
          }
          if (clienteId) {
            await aplicarSubscriptionNoCliente(clienteId, {
              ...subscription,
              metadata: {
                ...subscription.metadata,
                cliente_id: clienteId,
              },
            })
          } else {
            await atualizarPorSubscription(subscription)
          }
        } else if (clienteId && customerId) {
          // Checkout sem subscription ainda: só vincula o customer; status vem do evento de assinatura.
          const admin = supabaseAdmin()
          await admin
            .from('clientes')
            .update({
              stripe_customer_id: customerId,
            })
            .eq('id', clienteId)
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await atualizarPorSubscription(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await atualizarPorSubscription(subscription)
        }
        break
      }

      default:
        break
    }

    return jsonResponse({ received: true })
  } catch (err) {
    console.error('stripe-webhook handler', err)
    return jsonResponse({ error: 'Erro interno' }, 500)
  }
})
