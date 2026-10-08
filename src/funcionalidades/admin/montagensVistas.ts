import { useEffect, useState } from 'react'

export const EVENTO_MONTAGENS_VISTAS = 'montagens-vistas'

export function chaveMontagensVistas(clienteId: string): string {
  return `montagens-vistas:${clienteId}`
}

/** Sem marca, conta. Posterior à marca conta; igual ou anterior não. */
export function montagemContaComoNaoVista(
  createdAt: string,
  vistoAte: string | null,
): boolean {
  if (!vistoAte) return true
  return createdAt > vistoAte
}

export function lerMontagensVistoAte(clienteId: string): string | null {
  try {
    const raw = localStorage.getItem(chaveMontagensVistas(clienteId))
    if (!raw || Number.isNaN(Date.parse(raw))) return null
    return raw
  } catch {
    return null
  }
}

export function marcarMontagensVistas(clienteId: string, ateIso: string): void {
  if (Number.isNaN(Date.parse(ateIso))) return
  const atual = lerMontagensVistoAte(clienteId)
  if (atual && !montagemContaComoNaoVista(ateIso, atual)) return
  try {
    localStorage.setItem(chaveMontagensVistas(clienteId), ateIso)
  } catch {
    return
  }
  window.dispatchEvent(
    new CustomEvent(EVENTO_MONTAGENS_VISTAS, {
      detail: { clienteId, ateIso },
    }),
  )
}

export function useMontagensVistoAte(clienteId: string | undefined): string | null {
  const [ate, setAte] = useState<string | null>(() =>
    clienteId ? lerMontagensVistoAte(clienteId) : null,
  )

  useEffect(() => {
    if (!clienteId) {
      setAte(null)
      return
    }

    function sincronizar() {
      setAte(lerMontagensVistoAte(clienteId!))
    }

    sincronizar()
    window.addEventListener(EVENTO_MONTAGENS_VISTAS, sincronizar)
    window.addEventListener('storage', sincronizar)
    return () => {
      window.removeEventListener(EVENTO_MONTAGENS_VISTAS, sincronizar)
      window.removeEventListener('storage', sincronizar)
    }
  }, [clienteId])

  return ate
}
