import { describe, expect, it } from 'vitest'
import { assertUrlStripeSegura } from './assinaturaStripe'

describe('assertUrlStripeSegura', () => {
  it('aceita checkout.stripe.com', () => {
    expect(() =>
      assertUrlStripeSegura(
        'https://checkout.stripe.com/c/pay/cs_test_abc',
        'criar-checkout',
      ),
    ).not.toThrow()
  })

  it('aceita billing.stripe.com', () => {
    expect(() =>
      assertUrlStripeSegura(
        'https://billing.stripe.com/session/xyz',
        'criar-portal',
      ),
    ).not.toThrow()
  })

  it('rejeita http', () => {
    expect(() =>
      assertUrlStripeSegura('http://checkout.stripe.com/c/pay/x', 'criar-checkout'),
    ).toThrow(/inválida/)
  })

  it('rejeita host estranho', () => {
    expect(() =>
      assertUrlStripeSegura('https://evil.example/phish', 'criar-checkout'),
    ).toThrow(/não reconhecida/)
  })
})
