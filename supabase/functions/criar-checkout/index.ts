import { corsHeadersPara, jsonResponseComCors } from '../_shared/cors.ts'
import {
  garantirCustomerStripe,
  priceId,
  priceIdAnual,
  siteUrl,
  stripeClient,
} from '../_shared/stripe.ts'
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

    const intervalo = await intervaloPedido(req)
    if (intervalo instanceof Response) return intervalo

    const { cliente } = await obterClienteDoUsuario(authHeader)
    const stripe = stripeClient()
    const admin = supabaseAdmin()

    const { customerId, precisouSalvar } = await garantirCustomerStripe(
      stripe,
      cliente.stripe_customer_id,
      {
        email: cliente.email,
        nome: cliente.nome,
        clienteId: cliente.id,
      },
    )

    if (precisouSalvar) {
      const { error } = await admin
        .from('clientes')
        .update({ stripe_customer_id: customerId })
        .eq('id', cliente.id)
      if (error) {
        console.error('Falha ao salvar stripe_customer_id', error)
        return jsonResponseComCors(req, { error: 'Não foi possível preparar a cobrança' }, 500)
      }
    }

    const base = siteUrl()
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: intervalo === 'anual' ? priceIdAnual() : priceId(), quantity: 1 }],
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
      return jsonResponseComCors(req, { error: 'Checkout sem URL' }, 500)
    }

    return jsonResponseComCors(req, { url: session.url })
  } catch (err) {
    if (err instanceof Response) return err
    const msg = err instanceof Error ? err.message : String(err)
    console.error('criar-checkout', msg, err)
    return jsonResponseComCors(req, { error: 'Não foi possível iniciar o checkout' }, 500)
  }
})

/** Sem corpo ou `mensal` → plano mensal. `anual` → plano anual. Outro valor → 400. */
async function intervaloPedido(req: Request): Promise<'mensal' | 'anual' | Response> {
  const texto = await req.text()
  if (!texto.trim()) return 'mensal'

  let body: unknown
  try {
    body = JSON.parse(texto)
  } catch {
    return jsonResponseComCors(req, { error: 'Corpo inválido' }, 400)
  }

  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponseComCors(req, { error: 'Corpo inválido' }, 400)
  }

  const intervalo = 'intervalo' in body ? body.intervalo : undefined
  if (intervalo == null || intervalo === 'mensal') return 'mensal'
  if (intervalo === 'anual') return 'anual'
  return jsonResponseComCors(req, { error: 'Intervalo de assinatura inválido' }, 400)
}
