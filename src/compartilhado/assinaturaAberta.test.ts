import { describe, expect, it } from 'vitest'
import { statusBloqueiaNovoCheckout } from '../../supabase/functions/_shared/assinaturaAberta.ts'

describe('statusBloqueiaNovoCheckout', () => {
  it('bloqueia assinatura ainda aberta', () => {
    for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']) {
      expect(statusBloqueiaNovoCheckout(status)).toBe(true)
    }
  })

  it('permite novo checkout depois de cancelada ou expirada', () => {
    expect(statusBloqueiaNovoCheckout('canceled')).toBe(false)
    expect(statusBloqueiaNovoCheckout('incomplete_expired')).toBe(false)
  })
})
