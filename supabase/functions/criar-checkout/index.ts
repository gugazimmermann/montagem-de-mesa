import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { priceId, siteUrl, stripeClient } from '../_shared/stripe.ts'
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
    const stripe = stripeClient()
    const admin = supabaseAdmin()

    let customerId = cliente.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: cliente.email,
        name: cliente.nome,
        metadata: { cliente_id: cliente.id },
      })
      customerId = customer.id
      const { error } = await admin
        .from('clientes')
        .update({ stripe_customer_id: customerId })
        .eq('id', cliente.id)
      if (error) {
        console.error('Falha ao salvar stripe_customer_id', error)
        return jsonResponse({ error: 'Não foi possível preparar o cliente Stripe' }, 500)
      }
    }

    const base = siteUrl()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId(), quantity: 1 }],
      success_url: `${base}/admin/assinatura?checkout=sucesso`,
      cancel_url: `${base}/admin/assinatura?checkout=cancelado`,
      client_reference_id: cliente.id,
      metadata: { cliente_id: cliente.id },
      subscription_data: {
        metadata: { cliente_id: cliente.id },
      },
      allow_promotion_codes: true,
    })

    if (!session.url) {
      return jsonResponse({ error: 'Checkout sem URL' }, 500)
    }

    return jsonResponse({ url: session.url })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('criar-checkout', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return jsonResponse({ error: message }, 500)
  }
})
