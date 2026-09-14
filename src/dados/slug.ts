const SLUGS_RESERVADOS = new Set([
  'admin',
  'entrar',
  'cadastro',
  'assets',
  'c',
  'assinatura',
  'painel',
])

/** Slug URL: apenas a-z, 0-9, hífen e underscore. */
export function gerarSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/_{2,}/g, '_')
}

export function ehSlugReservado(slug: string): boolean {
  return SLUGS_RESERVADOS.has(slug)
}
