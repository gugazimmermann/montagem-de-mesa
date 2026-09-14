import { supabase } from './supabase'

export type DadosVisitanteMontagem = {
  nome: string
  email: string
  whatsapp: string
  endereco: string
  cidade: string
  estado: string
}

export type ItemMontagemEnviado = {
  categoria: string
  nome: string
}

export type PayloadEnviarMontagem = {
  slug: string
  visitante: DadosVisitanteMontagem
  itens: ItemMontagemEnviado[]
  linkMontagem: string
  idempotencyKey?: string
}

type RespostaEnviar = {
  ok?: boolean
  deduplicated?: boolean
  error?: string
}

export async function enviarMontagemParaAdmin(
  payload: PayloadEnviarMontagem,
): Promise<void> {
  const body = {
    ...payload,
    idempotencyKey:
      payload.idempotencyKey ??
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
  }

  const { data, error } = await supabase.functions.invoke<RespostaEnviar>(
    'enviar-montagem',
    { body },
  )

  if (error) {
    const msg = await mensagemErroInvoke(error, data)
    throw new Error(msg)
  }

  if (data?.error) {
    throw new Error(data.error)
  }

  if (!data?.ok) {
    throw new Error('Não foi possível enviar a montagem. Tente novamente.')
  }
}

async function mensagemErroInvoke(
  error: { message: string },
  data: RespostaEnviar | null,
): Promise<string> {
  if (data?.error) return data.error

  const context = (error as { context?: Response }).context
  if (context && typeof context.json === 'function') {
    try {
      const corpo = (await context.json()) as RespostaEnviar
      if (corpo?.error) return corpo.error
    } catch {
      // ignora corpo inválido
    }
  }

  return error.message || 'Não foi possível enviar a montagem. Tente novamente.'
}
