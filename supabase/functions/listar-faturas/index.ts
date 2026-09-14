import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { stripeClient } from '../_shared/stripe.ts'
import {
  resumoDeSubscription,
  sincronizarClienteComStripe,
} from '../_shared/syncAssinatura.ts'
import { obterClienteDoUsuario } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Não autenticado' }, 401)
    }

    const { cliente } = await obterClienteDoUsuario(authHeader)

    if (!cliente.stripe_customer_id) {
      return jsonResponse({
        faturas: [],
        assinatura: null,
      })
    }

    // Se o DB ainda está desatualizado (ex.: webhook atrasado), sincroniza primeiro
    let clienteAtual = cliente
    if (
      cliente.subscription_status === 'trialing' ||
      !cliente.stripe_subscription_id
    ) {
      try {
        const sync = await sincronizarClienteComStripe(cliente)
        if (sync.synced && sync.patch) {
          clienteAtual = {
            ...cliente,
            stripe_subscription_id: sync.patch.stripe_subscription_id,
            stripe_customer_id:
              sync.patch.stripe_customer_id ?? cliente.stripe_customer_id,
            subscription_status: sync.patch.subscription_status,
            current_period_end: sync.patch.current_period_end,
          }
        }
      } catch (e) {
        console.error('listar-faturas sync', e)
      }
    }

    const stripe = stripeClient()

    const invoices = await stripe.invoices.list({
      customer: clienteAtual.stripe_customer_id!,
      status: 'paid',
      limit: 24,
    })

    const faturas = invoices.data.map((inv) => {
      const linha = inv.lines?.data?.[0]
      const bruta =
        linha?.description ?? inv.description ?? 'Assinatura'
      const descricao = bruta
        .replace(/\(at\s+/gi, '(')
        .replace(/\bmonths?\b/gi, 'mês')
        .replace(/\byears?\b/gi, 'ano')
        .replace(/\bweeks?\b/gi, 'semana')
        .replace(/\bdays?\b/gi, 'dia')
        .replace(/R\$\s*(\d+)\.(\d{2})/g, 'R$ $1,$2')
        .replace(/\s+\/\s+/g, ' / ')
        .trim()

      return {
        id: inv.id,
        valor: inv.amount_paid,
        moeda: (inv.currency || 'brl').toUpperCase(),
        pagoEm: inv.status_transitions?.paid_at
          ? new Date(inv.status_transitions.paid_at * 1000).toISOString()
          : inv.created
            ? new Date(inv.created * 1000).toISOString()
            : null,
        faturaUrl: inv.hosted_invoice_url,
        pdfUrl: inv.invoice_pdf,
        descricao,
      }
    })

    let assinatura: {
      status: string
      cancelAtPeriodEnd: boolean
      currentPeriodEnd: string | null
    } | null = null

    if (clienteAtual.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(
          clienteAtual.stripe_subscription_id,
        )
        assinatura = resumoDeSubscription(sub)
      } catch (e) {
        console.error('listar-faturas subscription', e)
      }
    }

    return jsonResponse({
      faturas,
      assinatura,
      subscriptionStatus: clienteAtual.subscription_status,
      stripeSubscriptionId: clienteAtual.stripe_subscription_id,
      currentPeriodEnd: clienteAtual.current_period_end,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('listar-faturas', err)
    return jsonResponse({ error: 'Erro interno' }, 500)
  }
})
