const DDI_BRASIL = '55'

/** DDD + número (até 11 dígitos), sem o 55. */
export function digitosWhatsappNacional(valor: string): string {
  let digitos = valor.replace(/\D/g, '')
  if (digitos.startsWith(DDI_BRASIL) && digitos.length > 11) {
    digitos = digitos.slice(DDI_BRASIL.length)
  }
  return digitos.slice(0, 11)
}

/** Máscara amigável: (11) 99999-9999 */
export function formatarWhatsapp(valor: string): string {
  const digitos = digitosWhatsappNacional(valor)
  if (!digitos) return ''
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`
}

/**
 * Normaliza para armazenamento (E.164 BR sem +): 55 + DDD + número.
 * Vazio se não houver dígitos.
 */
export function normalizarWhatsapp(valor: string): string {
  const nacional = digitosWhatsappNacional(valor)
  if (!nacional) return ''
  return `${DDI_BRASIL}${nacional}`
}
