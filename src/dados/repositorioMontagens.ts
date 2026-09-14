import type { ItemMontagemEnviada, MontagemEnviada } from '../compartilhado/tipos'
import { supabase } from './supabase'

export const MONTAGENS_PAGE_SIZE = 50

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
  }
}

export type PaginaMontagens = {
  itens: MontagemEnviada[]
  temMais: boolean
}

export async function listarMontagensEnviadas(
  clienteId: string,
  opcoes?: { offset?: number; limit?: number },
): Promise<PaginaMontagens> {
  const limit = opcoes?.limit ?? MONTAGENS_PAGE_SIZE
  const offset = opcoes?.offset ?? 0
  const ate = offset + limit - 1

  const { data, error } = await supabase
    .from('montagens_enviadas')
    .select(
      'id, cliente_id, visitante_nome, visitante_email, visitante_whatsapp, visitante_endereco, visitante_cidade, visitante_estado, itens, link_montagem, created_at',
    )
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
    .range(offset, ate)

  if (error) throw error
  const itens = (data as RowMontagem[] | null)?.map(mapMontagem) ?? []
  return {
    itens,
    temMais: itens.length === limit,
  }
}
