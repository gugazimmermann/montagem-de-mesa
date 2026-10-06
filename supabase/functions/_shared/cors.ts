const ALLOW_HEADERS =
  'authorization, x-client-info, apikey, content-type, stripe-signature'

function siteUrlBase(): string | null {
  const url = Deno.env.get('SITE_URL')?.replace(/\/$/, '')
  return url || null
}

function ehOrigemLocal(origin: string): boolean {
  try {
    const u = new URL(origin)
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

/** Origens permitidas: SITE_URL + sempre localhost/127.0.0.1 (dev). */
export function origemPermitida(req: Request): string | null {
  const origin = req.headers.get('Origin')
  if (!origin) return null

  const limpo = origin.replace(/\/$/, '')
  if (ehOrigemLocal(limpo)) return limpo

  const site = siteUrlBase()
  if (site && limpo === site) return limpo

  return null
}

/** CORS para Edge Functions chamadas pelo browser (SITE_URL + localhost). */
export function corsHeadersPara(req: Request): Record<string, string> {
  const origin = origemPermitida(req)
  // Sem Origin (curl / gateway): ecoa SITE_URL; com Origin válida: ecoa a origem.
  const allow = origin ?? siteUrlBase() ?? 'null'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': ALLOW_HEADERS,
    Vary: 'Origin',
  }
}

/**
 * CORS aberto — só para o webhook Stripe (sem Origin de browser confiável).
 * Preferir `corsHeadersPara` / `jsonResponseComCors` nas demais functions.
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': ALLOW_HEADERS,
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}

export function jsonResponseComCors(
  req: Request,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeadersPara(req),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  })
}
