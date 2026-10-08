import type { MontagemEnviada } from '../../compartilhado/tipos'

const COLUNAS = [
  'data',
  'nome',
  'whatsapp',
  'email',
  'endereco',
  'cidade',
  'estado',
  'status',
  'itens',
  'link',
  'nota',
] as const

export const LEAD_PARADO_MS = 24 * 60 * 60 * 1000

export function leadNovoParado(
  status: string,
  createdAt: string,
  agora = Date.now(),
): boolean {
  if (status !== 'novo') return false
  const instante = Date.parse(createdAt)
  if (!Number.isFinite(instante)) return false
  return agora - instante >= LEAD_PARADO_MS
}

export function inicioDoDiaLocal(dataIso: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return undefined
  const data = new Date(`${dataIso}T00:00:00`)
  if (Number.isNaN(data.getTime())) return undefined
  return data.toISOString()
}

export function fimDoDiaLocal(dataIso: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) return undefined
  const data = new Date(`${dataIso}T23:59:59.999`)
  if (Number.isNaN(data.getTime())) return undefined
  return data.toISOString()
}

function celula(valor: string): string {
  return `"${valor.replaceAll('"', '""')}"`
}

export function montagensParaCsv(montagens: MontagemEnviada[]): string {
  const linhas = montagens.map((m) =>
    [
      m.createdAt,
      m.visitanteNome,
      m.visitanteWhatsapp,
      m.visitanteEmail,
      m.visitanteEndereco,
      m.visitanteCidade,
      m.visitanteEstado,
      m.leadStatus,
      m.itens.map((item) => `${item.categoria}: ${item.nome}`).join(' | '),
      m.linkMontagem,
      m.notaInterna,
    ]
      .map(celula)
      .join(','),
  )
  return `\uFEFF${COLUNAS.join(',')}\n${linhas.join('\n')}`
}

export function baixarCsv(conteudo: string, nomeArquivo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
