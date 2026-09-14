import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { sincronizarClienteComStripe } from '../_shared/syncAssinatura.ts'
import { obterClienteDoUsuario } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Não autenticado' }, 401)
    }

    const { cliente } = await obterClienteDoUsuario(authHeader)
    const resultado = await sincronizarClienteComStripe(cliente)

    return jsonResponse({
      synced: resultado.synced,
      patch: resultado.patch,
      assinatura: resultado.assinatura,
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('sincronizar-assinatura', err)
    return jsonResponse({ error: 'Erro interno' }, 500)
  }
})
