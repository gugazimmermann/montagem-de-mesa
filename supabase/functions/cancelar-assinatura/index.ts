import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { obterClienteDoUsuario, supabaseAdmin } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Não autenticado' }, 401)
    }

    const { cliente } = await obterClienteDoUsuario(authHeader)

    if (!cliente.stripe_subscription_id) {
      return jsonResponse(
        { error: 'Nenhuma assinatura Stripe ativa para cancelar.' },
        400,
      )
    }

    const stripe = stripeClient()
    const subscription = await stripe.subscriptions.update(
      cliente.stripe_subscription_id,
      { cancel_at_period_end: true },
    )

    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : cliente.current_period_end

    const admin = supabaseAdmin()
    const { error } = await admin
      .from('clientes')
      .update({ current_period_end: currentPeriodEnd })
      .eq('id', cliente.id)

    if (error) {
      console.error('cancelar-assinatura update db', error)
    }

    return jsonResponse({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd,
      status: subscription.status,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('cancelar-assinatura', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return jsonResponse({ error: message }, 500)
  }
})
