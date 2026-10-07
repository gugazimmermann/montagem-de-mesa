/** Padrões do produto (espelham `:root` em index.css). */
export const COR_MARCA_PADRAO = '#3d5c4a'
export const COR_FUNDO_PADRAO = '#eef1ef'

const HEX_COR = /^#[0-9A-Fa-f]{6}$/

const VARS_IDENTIDADE = [
  '--accent',
  '--accent-hover',
  '--accent-soft',
  '--accent-bg',
  '--on-accent',
  '--bg',
  '--surface',
  '--surface-solid',
  '--surface-elevated',
  '--border',
  '--text',
  '--text-muted',
] as const

export function ehHexCor(valor: string): boolean {
  return HEX_COR.test(valor.trim())
}

/** Normaliza para `#rrggbb` minúsculo ou `''` se vazio/inválido. */
export function normalizarHexCor(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  if (!v) return ''
  const comHash = v.startsWith('#') ? v : `#${v}`
  if (!ehHexCor(comHash)) return ''
  return comHash.toLowerCase()
}

function luminanciaRelativa(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function onAccent(hex: string): string {
  return luminanciaRelativa(hex) > 0.45 ? '#1a2421' : '#ffffff'
}

export type VarsIdentidadeLoja = Partial<
  Record<(typeof VARS_IDENTIDADE)[number], string>
>

/** Monta overrides de CSS vars a partir das cores da loja (só as que existirem). */
export function varsIdentidadeLoja(
  corMarca: string,
  corFundo: string,
): VarsIdentidadeLoja {
  const marca = normalizarHexCor(corMarca)
  const fundo = normalizarHexCor(corFundo)
  const vars: VarsIdentidadeLoja = {}

  if (marca) {
    vars['--accent'] = marca
    vars['--accent-hover'] = `color-mix(in srgb, ${marca} 82%, #000)`
    vars['--accent-soft'] = `color-mix(in srgb, ${marca} 55%, #fff)`
    vars['--accent-bg'] = `color-mix(in srgb, ${marca} 14%, #fff)`
    vars['--on-accent'] = onAccent(marca)
  }

  if (fundo) {
    vars['--bg'] = fundo
    vars['--surface'] = `color-mix(in srgb, ${fundo} 55%, #fff)`
    vars['--surface-solid'] = '#ffffff'
    vars['--surface-elevated'] = `color-mix(in srgb, ${fundo} 72%, #fff)`
    vars['--border'] = `color-mix(in srgb, ${fundo} 62%, #8a9a92)`
    const textoEscuro = luminanciaRelativa(fundo) > 0.55
    vars['--text'] = textoEscuro ? '#1a2421' : '#f5f7f6'
    vars['--text-muted'] = textoEscuro
      ? `color-mix(in srgb, ${vars['--text']} 62%, ${fundo})`
      : `color-mix(in srgb, ${vars['--text']} 72%, ${fundo})`
  }

  return vars
}

export function aplicarIdentidadeLoja(
  corMarca: string,
  corFundo: string,
  alvo: HTMLElement = document.documentElement,
): void {
  const vars = varsIdentidadeLoja(corMarca, corFundo)
  for (const nome of VARS_IDENTIDADE) {
    const valor = vars[nome]
    if (valor) alvo.style.setProperty(nome, valor)
    else alvo.style.removeProperty(nome)
  }
}

export function limparIdentidadeLoja(
  alvo: HTMLElement = document.documentElement,
): void {
  for (const nome of VARS_IDENTIDADE) {
    alvo.style.removeProperty(nome)
  }
}
