import type {
  ItemMontagemEnviada,
  MontagemEnviada,
  StatusEmailMontagem,
  StatusLeadMontagem,
} from '../compartilhado/tipos'
import { supabase } from './supabase'

export const MONTAGENS_PAGE_SIZE = 50

export type FiltrosMontagens = {
  busca?: string
  leadStatus?: StatusLeadMontagem | 'todos'
  offset?: number
  limit?: number
}

type RowMontagem = {
  id: string
  cliente_id: string
  visitante_nome: string
  visitante_email: string
  visitante_whatsapp: string
  visitante_endereco: string
  visitante_cidade: string
  visitante_estado: string
  itens: unknown
  link_montagem: string
  created_at: string
  email_status?: string | null
  lead_status?: string | null
  nota_interna?: string | null
}

function mapItens(raw: unknown): ItemMontagemEnviada[] {
  if (!Array.isArray(raw)) return []
  const itens: ItemMontagemEnviada[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const categoria = (entry as { categoria?: unknown }).categoria
    const nome = (entry as { nome?: unknown }).nome
    if (typeof categoria !== 'string' || typeof nome !== 'string') continue
    const cat = categoria.trim()
    const n = nome.trim()
    if (!cat || !n) continue
    itens.push({ categoria: cat, nome: n })
  }
  return itens
}

function mapEmailStatus(raw: string | null | undefined): StatusEmailMontagem {
  if (raw === 'sent' || raw === 'failed' || raw === 'pending') return raw
  return 'pending'
}

function mapLeadStatus(raw: string | null | undefined): StatusLeadMontagem {
  if (
    raw === 'novo' ||
    raw === 'contatado' ||
    raw === 'fechado' ||
    raw === 'arquivado'
  ) {
    return raw
  }
  return 'novo'
}

function mapMontagem(row: RowMontagem): MontagemEnviada {
  return {
    id: row.id,
    clienteId: row.cliente_id,
    visitanteNome: row.visitante_nome,
    visitanteEmail: row.visitante_email,
    visitanteWhatsapp: row.visitante_whatsapp,
    visitanteEndereco: row.visitante_endereco,
    visitanteCidade: row.visitante_cidade,
    visitanteEstado: row.visitante_estado,
    itens: mapItens(row.itens),
    linkMontagem: row.link_montagem,
    createdAt: row.created_at,
    emailStatus: mapEmailStatus(row.email_status),
    leadStatus: mapLeadStatus(row.lead_status),
    notaInterna: row.nota_interna ?? '',
  }
}

export type PaginaMontagens = {
  itens: MontagemEnviada[]
  temMais: boolean
}

const SELECT_MONTAGEM =
  'id, cliente_id, visitante_nome, visitante_email, visitante_whatsapp, visitante_endereco, visitante_cidade, visitante_estado, itens, link_montagem, created_at, email_status, lead_status, nota_interna'

export async function listarMontagensEnviadas(
  clienteId: string,
  opcoes?: FiltrosMontagens,
): Promise<PaginaMontagens> {
  const limit = opcoes?.limit ?? MONTAGENS_PAGE_SIZE
  const offset = opcoes?.offset ?? 0
  const ate = offset + limit - 1
  const busca = opcoes?.busca?.trim()
  const leadStatus = opcoes?.leadStatus

  let query = supabase
    .from('montagens_enviadas')
    .select(SELECT_MONTAGEM)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .range(offset, ate)

  if (leadStatus && leadStatus !== 'todos') {
    query = query.eq('lead_status', leadStatus)
  }

  if (busca) {
    const seguro = busca.replace(/[%_,.()]/g, ' ').trim()
    if (seguro) {
      const termo = `%${seguro}%`
      query = query.or(
        `visitante_nome.ilike.${termo},visitante_email.ilike.${termo},visitante_cidade.ilike.${termo},visitante_whatsapp.ilike.${termo}`,
      )
    }
  }

  const { data, error } = await query
  if (error) throw error
  const itens = (data as RowMontagem[] | null)?.map(mapMontagem) ?? []
  return {
    itens,
    temMais: itens.length === limit,
  }
}

export async function contarMontagensNovas(clienteId: string): Promise<number> {
  const { count, error } = await supabase
    .from('montagens_enviadas')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .eq('lead_status', 'novo')

  if (error) throw error
  return count ?? 0
}

export async function atualizarLeadMontagem(
  clienteId: string,
  montagemId: string,
  patch: { leadStatus?: StatusLeadMontagem; notaInterna?: string },
): Promise<MontagemEnviada> {
  const update: Record<string, string> = {}
  if (patch.leadStatus !== undefined) update.lead_status = patch.leadStatus
  if (patch.notaInterna !== undefined) {
    update.nota_interna = patch.notaInterna.slice(0, 2000)
  }

  const { data, error } = await supabase
    .from('montagens_enviadas')
    .update(update)
    .eq('cliente_id', clienteId)
    .eq('id', montagemId)
    .select(SELECT_MONTAGEM)
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error('Montagem não encontrada ou sem permissão.')
  return mapMontagem(data as RowMontagem)
}

type RespostaReenviar = { ok?: boolean; error?: string }

export async function reenviarEmailMontagem(montagemId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<RespostaReenviar>(
    'enviar-montagem',
    { body: { acao: 'reenviar', montagemId } },
  )

  if (error) {
    const context = (error as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const corpo = (await context.json()) as RespostaReenviar
        if (corpo?.error) throw new Error(corpo.error)
      } catch (e) {
        if (e instanceof Error && e.message !== error.message) throw e
      }
    }
    throw new Error(error.message || 'Não foi possível reenviar o e-mail.')
  }

  if (data?.error) throw new Error(data.error)
  if (!data?.ok) throw new Error('Não foi possível reenviar o e-mail.')
}
