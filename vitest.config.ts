import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// CI não tem .env. O cliente Supabase é criado na importação, então os testes
// precisam de URL e anon key mesmo quando não falam com o servidor.
const arquivo = loadEnv('test', process.cwd(), '')

if (!process.env.VITE_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = arquivo.VITE_SUPABASE_URL || 'https://example.supabase.co'
}
if (!process.env.VITE_SUPABASE_ANON_KEY) {
  process.env.VITE_SUPABASE_ANON_KEY = arquivo.VITE_SUPABASE_ANON_KEY || 'test-anon-key'
}

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/test/**'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
})
