import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.111.0'

export function supabaseAdmin(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios')
  }
  return createClient(url, key)
}

export function supabaseComJwt(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) {
    throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios')
  }
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  })
}

export type ClienteBilling = {
  id: string
  email: string
  nome: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string
  trial_ends_at: string | null
  current_period_end: string | null
}

export async function obterClienteDoUsuario(
  authHeader: string,
): Promise<{ userId: string; cliente: ClienteBilling }> {
  const supabase = supabaseComJwt(authHeader)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    throw new Response(JSON.stringify({ error: 'Não autenticado' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  const admin = supabaseAdmin()
  const { data: cliente, error } = await admin
    .from('clientes')
    .select(
      'id, email, nome, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, current_period_end',
    )
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (error || !cliente) {
    throw new Response(JSON.stringify({ error: 'Cliente não encontrado' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  return { userId: user.id, cliente: cliente as ClienteBilling }
}
