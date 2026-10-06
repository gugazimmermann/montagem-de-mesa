import { corsHeadersPara, jsonResponseComCors } from '../_shared/cors.ts'
import { siteUrl, stripeClient } from '../_shared/stripe.ts'
import { obterClienteDoUsuario } from '../_shared/supabase.ts'

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

    if (!cliente.stripe_customer_id) {
      return jsonResponseComCors(req, 
        { error: 'Nenhuma assinatura vinculada. Assine primeiro.' },
        400,
      )
    }

    const stripe = stripeClient()
    const session = await stripe.billingPortal.sessions.create({
      customer: cliente.stripe_customer_id,
      return_url: `${siteUrl()}/admin/assinatura`,
    })

    return jsonResponseComCors(req, { url: session.url })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('criar-portal', err)
    return jsonResponseComCors(req, { error: 'Erro interno' }, 500)
  }
})
