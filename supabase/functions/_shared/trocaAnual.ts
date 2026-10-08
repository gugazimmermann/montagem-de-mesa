/** Preço mensal R$ 49,90 e anual R$ 538,92 (10% sobre 12 meses), em centavos. */
export const PRECO_MENSAL_CENTAVOS = 4990
export const PRECO_ANUAL_CENTAVOS = 53892

const FUSO_ANUAL = 'America/Sao_Paulo'

export type ContaTrocaAnual = {
  inicioAnual: Date
  aCobrarCentavos: number
  fim: Date
}

function anoEmSaoPaulo(data: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: FUSO_ANUAL,
      year: 'numeric',
    }).format(data),
  )
}

/** 1º de janeiro às 00:00 em America/Sao_Paulo (UTC−3, sem horário de verão). */
function inicioAnoSaoPaulo(ano: number): Date {
  return new Date(Date.UTC(ano, 0, 1, 3, 0, 0))
}

/**
 * O mês já pago segue até o fim do período mensal. O anual começa aí e
 * termina em 31/12 do mesmo ano. A cobrança agora é R$ 538,92 vezes a
 * fração desse trecho sobre o ano civil.
 */
export function calcularTrocaAnual(entrada: {
  fimPeriodoMensal: Date
}): ContaTrocaAnual {
  const inicioAnual = entrada.fimPeriodoMensal
  const ano = anoEmSaoPaulo(inicioAnual)
  const inicioAno = inicioAnoSaoPaulo(ano)
  const inicioAnoSeguinte = inicioAnoSaoPaulo(ano + 1)
  const fim = new Date(inicioAnoSeguinte.getTime() - 1)
  const duracaoAno = inicioAnoSeguinte.getTime() - inicioAno.getTime()
  const trecho = Math.max(0, Math.min(duracaoAno, fim.getTime() - inicioAnual.getTime()))
  const aCobrarCentavos = Math.round((PRECO_ANUAL_CENTAVOS * trecho) / duracaoAno)
  return { inicioAnual, aCobrarCentavos, fim }
}
