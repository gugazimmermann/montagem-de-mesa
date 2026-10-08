/**
 * IP do visitante para rate limit.
 * `cf-connecting-ip` é definido pelo Cloudflare (Supabase sobrescreve o valor do cliente).
 * Em `x-forwarded-for`, o último salto é o que o proxy acrescenta; o primeiro pode ser forjado.
 */
export function ipCliente(headers: { get(name: string): string | null }): string {
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf

  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const partes = forwarded
      .split(',')
      .map((parte) => parte.trim())
      .filter(Boolean)
    const ultimo = partes.at(-1)
    if (ultimo) return ultimo
  }

  return 'unknown'
}
