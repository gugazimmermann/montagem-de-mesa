import { statusBloqueiaNovoCheckout } from '../_shared/assinaturaAberta.ts'
import { corsHeadersPara, jsonResponseComCors } from '../_shared/cors.ts'
import {
  garantirCustomerStripe,
  priceId,
  priceIdAnual,
  siteUrl,
  stripeClient,
} from '../_shared/stripe.ts'
import { aplicarSubscriptionNoCliente } from '../_shared/syncAssinatura.ts'
import { obterClienteDoUsuario, supabaseAdmin } from '../_shared/supabase.ts'
import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

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

    const aberta = await assinaturaAberta(stripe, cliente)
    if (aberta) {
      try {
        await aplicarSubscriptionNoCliente(cliente.id, aberta)
      } catch (syncErr) {
        console.error('criar-checkout sync assinatura existente', syncErr)
      }
      return jsonResponseComCors(
        req,
        { error: 'Esta conta já tem uma assinatura. Atualize a página para gerenciá-la.' },
        409,
      )
    }

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

async function assinaturaAberta(
  stripe: Stripe,
  cliente: { stripe_customer_id: string | null; stripe_subscription_id: string | null },
): Promise<Stripe.Subscription | null> {
  if (cliente.stripe_customer_id) {
    const lista = await stripe.subscriptions.list({
      customer: cliente.stripe_customer_id,
      status: 'all',
      limit: 10,
    })
    return lista.data.find((sub) => statusBloqueiaNovoCheckout(sub.status)) ?? null
  }

  if (!cliente.stripe_subscription_id) return null

  try {
    const sub = await stripe.subscriptions.retrieve(cliente.stripe_subscription_id)
    return statusBloqueiaNovoCheckout(sub.status) ? sub : null
  } catch (err) {
    const codigo = (err as { code?: string }).code
    if (codigo === 'resource_missing') return null
    throw err
  }
}

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
