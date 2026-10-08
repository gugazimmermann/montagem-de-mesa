import type Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'
import { corsHeadersPara, jsonResponseComCors } from '../_shared/cors.ts'
import { priceId, priceIdAnual, stripeClient } from '../_shared/stripe.ts'
import { aplicarSubscriptionNoCliente } from '../_shared/syncAssinatura.ts'
import { calcularTrocaAnual } from '../_shared/trocaAnual.ts'
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

    const confirmar = await pedidoConfirma(req)
    if (confirmar instanceof Response) return confirmar

    const { cliente } = await obterClienteDoUsuario(authHeader)
    if (!cliente.stripe_customer_id || !cliente.stripe_subscription_id) {
      return jsonResponseComCors(req, { error: 'Nenhuma assinatura mensal para trocar.' }, 400)
    }

    const stripe = stripeClient()
    const subscription = await stripe.subscriptions.retrieve(cliente.stripe_subscription_id)
    const mensal = priceId()
    const anual = priceIdAnual()
    const item = subscription.items.data.find((linha) => linha.price?.id === mensal)

    if (subscription.items.data.some((linha) => linha.price?.id === anual)) {
      return jsonResponseComCors(req, { error: 'Esta assinatura já é anual.' }, 400)
    }
    if (!item) {
      return jsonResponseComCors(req, { error: 'A assinatura atual não é o plano mensal.' }, 400)
    }
    if (subscription.status !== 'active' && subscription.status !== 'past_due') {
      return jsonResponseComCors(req, { error: 'A assinatura mensal não está ativa.' }, 400)
    }

    const fimMensal = fimPeriodoMensal(subscription)
    if (!fimMensal) {
      return jsonResponseComCors(
        req,
        { error: 'Não foi possível ler o fim do período mensal.' },
        400,
      )
    }
    const conta = calcularTrocaAnual({ fimPeriodoMensal: fimMensal })
    const fimUnix = Math.floor(Math.max(conta.fim.getTime(), Date.now() + 60_000) / 1000)
    const previa = {
      inicioAnual: conta.inicioAnual.toISOString(),
      aCobrarCentavos: conta.aCobrarCentavos,
      fim: new Date(fimUnix * 1000).toISOString(),
    }

    if (!confirmar) {
      return jsonResponseComCors(req, previa)
    }

    const pagamentoId = await formaPagamentoAssinatura(
      stripe,
      subscription,
      cliente.stripe_customer_id,
    )
    if (conta.aCobrarCentavos > 0 && !pagamentoId) {
      return jsonResponseComCors(
        req,
        { error: 'Não há cartão salvo nesta assinatura. Atualize a forma de pagamento e tente de novo.' },
        400,
      )
    }

    let faturaPagaId: string | null = null
    let trialAplicado = false
    try {
      if (conta.aCobrarCentavos > 0 && pagamentoId) {
        const fatura = await cobrarDiferenca(
          stripe,
          cliente.stripe_customer_id,
          conta.aCobrarCentavos,
          cliente.id,
          pagamentoId,
        )
        faturaPagaId = fatura.id
      }

      await stripe.subscriptions.update(subscription.id, {
        trial_end: fimUnix,
        proration_behavior: 'none',
        cancel_at_period_end: false,
      })
      trialAplicado = true

      const atualizada = await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: anual }],
        proration_behavior: 'none',
      })

      await aplicarSubscriptionNoCliente(cliente.id, atualizada)
      return jsonResponseComCors(req, previa)
    } catch (err) {
      if (trialAplicado) {
        await stripe.subscriptions.update(subscription.id, {
          trial_end: 'now',
          proration_behavior: 'none',
        }).catch((reverter) => console.error('reverter trial da troca', reverter))
      }
      if (faturaPagaId) {
        await estornarFatura(stripe, faturaPagaId)
      }
      throw err
    }
  } catch (err) {
    if (err instanceof Response) return err
    const stripeErr = err as { type?: string; message?: string }
    const detalhe = stripeErr.message?.trim()
    console.error('trocar-plano-anual', detalhe ?? err)
    if (stripeErr.type === 'StripeCardError') {
      return jsonResponseComCors(
        req,
        { error: 'O cartão foi recusado. O plano mensal continua.' },
        402,
      )
    }
    return jsonResponseComCors(
      req,
      { error: 'Não foi possível mudar para o plano anual.' },
      500,
    )
  }
})

async function pedidoConfirma(req: Request): Promise<boolean | Response> {
  const texto = await req.text()
  if (!texto.trim()) return false
  let body: unknown
  try {
    body = JSON.parse(texto)
  } catch {
    return jsonResponseComCors(req, { error: 'Corpo inválido' }, 400)
  }
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponseComCors(req, { error: 'Corpo inválido' }, 400)
  }
  const confirmar = 'confirmar' in body ? body.confirmar : false
  if (confirmar == null || confirmar === false) return false
  if (confirmar === true) return true
  return jsonResponseComCors(req, { error: 'Pedido inválido' }, 400)
}

function fimPeriodoMensal(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items.data[0] as (Stripe.SubscriptionItem & {
    current_period_end?: number | null
  }) | undefined
  const assinatura = subscription as Stripe.Subscription & {
    current_period_end?: number | null
  }
  const unix = assinatura.current_period_end ?? item?.current_period_end
  if (!unix) return null
  return new Date(unix * 1000)
}

function idRecurso(valor: string | { id: string } | null | undefined): string | null {
  if (!valor) return null
  return typeof valor === 'string' ? valor : valor.id
}

async function formaPagamentoAssinatura(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  customerId: string,
): Promise<string | null> {
  const daAssinatura = idRecurso(subscription.default_payment_method)
  if (daAssinatura) return daAssinatura
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null
  return idRecurso(customer.invoice_settings?.default_payment_method)
}

async function cobrarDiferenca(
  stripe: Stripe,
  customerId: string,
  centavos: number,
  clienteId: string,
  pagamentoId: string,
): Promise<Stripe.Invoice> {
  const item = await stripe.invoiceItems.create({
    customer: customerId,
    amount: centavos,
    currency: 'brl',
    description: 'Plano anual até 31/12',
  })
  let fatura: Stripe.Invoice | null = null
  try {
    fatura = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'charge_automatically',
      auto_advance: false,
      pending_invoice_items_behavior: 'include',
      default_payment_method: pagamentoId,
      metadata: { cliente_id: clienteId, troca_anual: 'true' },
    })
    return await stripe.invoices.pay(fatura.id, { payment_method: pagamentoId })
  } catch (err) {
    if (fatura?.id) {
      await descartarFaturaIncompleta(stripe, fatura.id)
    } else {
      await stripe.invoiceItems.del(item.id).catch(() => {})
    }
    throw err
  }
}

async function descartarFaturaIncompleta(stripe: Stripe, faturaId: string): Promise<void> {
  const fatura = await stripe.invoices.retrieve(faturaId).catch(() => null)
  if (!fatura || fatura.status === 'paid' || fatura.status === 'void') return
  if (fatura.status === 'draft') {
    await stripe.invoices.del(faturaId).catch(() => {})
    return
  }
  await stripe.invoices.voidInvoice(faturaId).catch(() => {})
}

async function estornarFatura(stripe: Stripe, faturaId: string): Promise<void> {
  try {
    const fatura = await stripe.invoices.retrieve(faturaId)
    const pagamento =
      typeof fatura.payment_intent === 'string'
        ? fatura.payment_intent
        : fatura.payment_intent?.id
    if (!pagamento) return
    await stripe.refunds.create({ payment_intent: pagamento })
  } catch (err) {
    console.error('estorno da diferença falhou', err)
  }
}
