/** Observabilidade leve: funil + erros. Integra Sentry se `window.Sentry` existir (snippet no index.html) ou VITE_SENTRY_DSN via script externo. */

export type EventoFunil =
  | 'catalog_loaded'
  | 'item_selected'
  | 'send_opened'
  | 'send_ok'
  | 'send_fail'
  | 'wa_opened'
  | 'wa_blocked'
  | 'paywall_hit'
  | 'checkout_success'

type PropsEvento = Record<string, string | number | boolean | undefined>

const FILA_MAX = 40
const fila: { nome: EventoFunil; props?: PropsEvento; em: number }[] = []

type SentryLike = {
  addBreadcrumb?: (b: {
    category: string
    message: string
    data?: PropsEvento
    level: string
  }) => void
  captureException?: (e: unknown, ctx?: { tags?: Record<string, string> }) => void
}

declare global {
  interface Window {
    __montagemObs?: {
      eventos: typeof fila
      rastrear: typeof rastrear
    }
    Sentry?: SentryLike
  }
}

function sentry(): SentryLike | undefined {
  return typeof window !== 'undefined' ? window.Sentry : undefined
}

export function rastrear(nome: EventoFunil, props?: PropsEvento): void {
  const registro = { nome, props, em: Date.now() }
  fila.push(registro)
  if (fila.length > FILA_MAX) fila.shift()

  if (import.meta.env.DEV) {
    console.info('[funil]', nome, props ?? {})
  }

  if (typeof window !== 'undefined') {
    window.__montagemObs = { eventos: fila, rastrear }
    window.dispatchEvent(
      new CustomEvent('montagem:funil', { detail: registro }),
    )
  }

  sentry()?.addBreadcrumb?.({
    category: 'funil',
    message: nome,
    data: props,
    level: 'info',
  })
}

export function capturarErro(erro: unknown, contexto?: string): void {
  console.error(contexto ?? 'erro', erro)
  sentry()?.captureException?.(erro, {
    tags: { contexto: contexto ?? 'app' },
  })
}
