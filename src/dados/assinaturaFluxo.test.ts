import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
}))
const invoke = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    auth,
    functions: { invoke },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
})

describe('cobrança stripe', () => {
  it('checkout, portal, troca, cancelamento, sync e faturas', async () => {
    const stripe = await import('./assinaturaStripe')

    expect(() => stripe.assertUrlStripeSegura('nao-url', 'criar-checkout')).toThrow(/inválida/)
    expect(() =>
      stripe.assertUrlStripeSegura('https://checkout.outra.com/x', 'criar-portal'),
    ).toThrow(/não reconhecida/)
    expect(() =>
      stripe.assertUrlStripeSegura('https://pay.stripe.com/x', 'criar-checkout'),
    ).not.toThrow()

    auth.getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(stripe.iniciarCheckoutAssinatura()).rejects.toThrow(/Sessão expirada/)

    invoke.mockResolvedValueOnce({
      data: { url: 'https://checkout.stripe.com/c/pay/x' },
      error: null,
    })
    expect(await stripe.iniciarCheckoutAssinatura('anual')).toContain('checkout.stripe.com')

    invoke.mockResolvedValueOnce({ data: null, error: { message: '' } })
    await expect(stripe.abrirPortalAssinatura()).rejects.toThrow(/cobrança/)

    invoke.mockResolvedValueOnce({ data: { error: 'sem url' }, error: null })
    await expect(stripe.abrirPortalAssinatura()).rejects.toThrow('sem url')

    invoke.mockResolvedValueOnce({ data: {}, error: null })
    await expect(stripe.abrirPortalAssinatura()).rejects.toThrow(/inválida/)

    const previa = {
      inicioAnual: '2026-11-01',
      aCobrarCentavos: 1000,
      fim: '2027-11-01',
    }
    invoke.mockResolvedValueOnce({ data: previa, error: null })
    expect(await stripe.previaTrocaAnual()).toEqual(previa)
    invoke.mockResolvedValueOnce({ data: previa, error: null })
    expect((await stripe.confirmarTrocaAnual()).fim).toBe('2027-11-01')

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'falha',
        context: { json: async () => ({ error: 'detalhe' }) },
      },
    })
    await expect(stripe.previaTrocaAnual()).rejects.toThrow('detalhe')

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: '',
        context: { json: async () => { throw new Error('json') } },
      },
    })
    await expect(stripe.confirmarTrocaAnual()).rejects.toThrow(/plano anual/)

    invoke.mockResolvedValueOnce({ data: { error: 'nao' }, error: null })
    await expect(stripe.previaTrocaAnual()).rejects.toThrow('nao')
    invoke.mockResolvedValueOnce({ data: null, error: null })
    await expect(stripe.previaTrocaAnual()).rejects.toThrow(/inválida/)

    invoke.mockResolvedValueOnce({
      data: { cancelAtPeriodEnd: true, status: 'active' },
      error: null,
    })
    expect((await stripe.cancelarAssinatura()).cancelAtPeriodEnd).toBe(true)
    invoke.mockResolvedValueOnce({ data: null, error: { message: '' } })
    await expect(stripe.cancelarAssinatura()).rejects.toThrow(/cancelar/)
    invoke.mockResolvedValueOnce({ data: { error: 'nao cancela' }, error: null })
    await expect(stripe.cancelarAssinatura()).rejects.toThrow('nao cancela')
    invoke.mockResolvedValueOnce({ data: null, error: null })
    expect(await stripe.cancelarAssinatura()).toEqual({})

    invoke.mockResolvedValueOnce({
      data: {
        synced: true,
        patch: { subscription_status: 'active' },
        assinatura: { status: 'active', cancelAtPeriodEnd: false, currentPeriodEnd: null },
      },
      error: null,
    })
    expect((await stripe.sincronizarAssinatura()).synced).toBe(true)
    invoke.mockResolvedValueOnce({ data: null, error: { message: 'sync' } })
    await expect(stripe.sincronizarAssinatura()).rejects.toThrow('sync')
    invoke.mockResolvedValueOnce({ data: { error: 'sem' }, error: null })
    await expect(stripe.sincronizarAssinatura()).rejects.toThrow('sem')
    invoke.mockResolvedValueOnce({ data: {}, error: null })
    expect((await stripe.sincronizarAssinatura()).patch).toBeNull()

    vi.useFakeTimers()
    invoke.mockResolvedValue({
      data: { synced: false, patch: { subscription_status: 'incomplete' }, assinatura: null },
      error: null,
    })
    const pendente = stripe.sincronizarAssinaturaComRetry(2, 10)
    await vi.runAllTimersAsync()
    expect((await pendente).synced).toBe(false)

    invoke.mockResolvedValueOnce({
      data: {
        synced: true,
        patch: null,
        assinatura: { status: 'past_due', cancelAtPeriodEnd: false, currentPeriodEnd: null },
      },
      error: null,
    })
    expect((await stripe.sincronizarAssinaturaComRetry(3, 0)).assinatura?.status).toBe(
      'past_due',
    )
    vi.useRealTimers()

    invoke.mockResolvedValueOnce({
      data: {
        faturas: [{ id: 'f', valor: 100, moeda: 'brl', pagoEm: null, faturaUrl: null, pdfUrl: null, descricao: 'x' }],
        assinatura: null,
        intervalo: 'anual',
        subscriptionStatus: 'active',
        stripeSubscriptionId: 'sub',
        currentPeriodEnd: '2099-01-01',
      },
      error: null,
    })
    expect((await stripe.listarFaturasPagas()).intervalo).toBe('anual')
    invoke.mockResolvedValueOnce({ data: null, error: { message: '' } })
    await expect(stripe.listarFaturasPagas()).rejects.toThrow(/histórico/)
    invoke.mockResolvedValueOnce({ data: { error: 'fat' }, error: null })
    await expect(stripe.listarFaturasPagas()).rejects.toThrow('fat')
    invoke.mockResolvedValueOnce({ data: {}, error: null })
    expect((await stripe.listarFaturasPagas()).faturas).toEqual([])

    expect(stripe.formatarValorFatura(4990, 'BRL')).toContain('49,90')
    expect(stripe.formatarValorFatura(100, 'MOEDA-INVALIDA')).toContain('1.00')
    expect(stripe.formatarDescricaoFaturaPtBr('(at R$ 49.90 / month)')).toContain('mês')
    expect(stripe.formatarDescricaoFaturaPtBr('1 year 2 weeks 3 days')).toContain('ano')
    expect(
      stripe.statusEfetivoAssinatura('trialing', {
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      }),
    ).toBe('active')
    expect(stripe.statusEfetivoAssinatura('trialing', null)).toBe('trialing')
    expect(stripe.assinaturaPagaAtiva('active')).toBe(true)
    expect(stripe.assinaturaPagaAtiva('canceled')).toBe(false)
  })
})
