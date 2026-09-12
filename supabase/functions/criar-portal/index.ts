import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { siteUrl, stripeClient } from '../_shared/stripe.ts'
import { obterClienteDoUsuario } from '../_shared/supabase.ts'

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

    if (!cliente.stripe_customer_id) {
      return jsonResponse(
        { error: 'Nenhuma assinatura Stripe vinculada. Assine primeiro.' },
        400,
      )
    }

    const stripe = stripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: cliente.stripe_customer_id,
      return_url: `${siteUrl()}/admin/assinatura`,
    })

    return jsonResponse({ url: session.url })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('criar-portal', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return jsonResponse({ error: message }, 500)
  }
})
