import { describe, expect, it, vi } from 'vitest'

describe('cliente supabase', () => {
  it('recusa subir sem url e chave', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
    await expect(import('./supabase')).rejects.toThrow(/VITE_SUPABASE_URL/)
    vi.unstubAllEnvs()
  })
})
