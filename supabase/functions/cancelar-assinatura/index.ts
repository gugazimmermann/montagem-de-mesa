import { corsHeadersPara, jsonResponseComCors } from '../_shared/cors.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { obterClienteDoUsuario, supabaseAdmin } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersPara(req) })
  }

  if (req.method !== 'POST') {
    return jsonResponseComCors(req, { error: 'Método não permitido' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponseComCors(req, { error: 'Não autenticado' }, 401)
    }

    const { cliente } = await obterClienteDoUsuario(authHeader)

    if (!cliente.stripe_subscription_id) {
      return jsonResponseComCors(req, 
        { error: 'Nenhuma assinatura ativa para cancelar.' },
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

    return jsonResponseComCors(req, {
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd,
      status: subscription.status,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('cancelar-assinatura', err)
    return jsonResponseComCors(req, { error: 'Erro interno' }, 500)
  }
})
