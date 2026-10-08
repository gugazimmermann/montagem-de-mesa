import { supabase } from './supabase'

export type ResumoFunil = {
  /** `null` quando a contagem de visitas ainda não está disponível. */
  visitas7: number | null
  visitas30: number | null
  envios7: number
  envios30: number
}

const MS_DIA = 24 * 60 * 60 * 1000

function diaSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(data)
}

export function taxaEnvio(envios: number, visitas: number | null): number | null {
  if (visitas == null || visitas <= 0) return null
  return envios / visitas
}

export async function registrarVisitaCatalogo(slug: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_visita_catalogo', {
    p_slug: slug,
  })
  if (error) throw error
}

async function contarEnviosDesde(clienteId: string, desdeIso: string): Promise<number> {
  const { count, error } = await supabase
    .from('montagens_enviadas')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .gte('created_at', desdeIso)
  if (error) throw error
  return count ?? 0
}

export async function carregarResumoFunil(clienteId: string): Promise<ResumoFunil> {
  const agora = new Date()
  const desde30 = new Date(agora.getTime() - 30 * MS_DIA).toISOString()
  const desde7 = new Date(agora.getTime() - 7 * MS_DIA).toISOString()
  const diaCorte = diaSaoPaulo(new Date(agora.getTime() - 30 * MS_DIA))

  const [visitasRes, envios7, envios30] = await Promise.all([
    supabase
      .from('visitas_catalogo_dia')
      .select('dia, total')
      .eq('cliente_id', clienteId)
      .gte('dia', diaCorte),
    contarEnviosDesde(clienteId, desde7),
    contarEnviosDesde(clienteId, desde30),
  ])

  if (visitasRes.error) {
    return { visitas7: null, visitas30: null, envios7, envios30 }
  }

  const corte7 = diaSaoPaulo(new Date(agora.getTime() - 7 * MS_DIA))
  let visitas7 = 0
  let visitas30 = 0
  for (const linha of visitasRes.data ?? []) {
    const total = typeof linha.total === 'number' ? linha.total : 0
    const dia = typeof linha.dia === 'string' ? linha.dia : ''
    visitas30 += total
    if (dia >= corte7) visitas7 += total
  }

  return { visitas7, visitas30, envios7, envios30 }
}
