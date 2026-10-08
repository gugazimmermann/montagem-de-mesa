const STATUS_QUE_BLOQUEIAM_CHECKOUT = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'incomplete',
  'paused',
])

/** Assinatura ainda cobrável ou em aberto. `canceled` e `incomplete_expired` não bloqueiam. */
export function statusBloqueiaNovoCheckout(status: string): boolean {
  return STATUS_QUE_BLOQUEIAM_CHECKOUT.has(status)
}
