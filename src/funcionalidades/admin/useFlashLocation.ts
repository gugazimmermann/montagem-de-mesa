import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** Lê `state.flash`, limpa a location e auto-dismiss após 4s. */
export function useFlashLocation() {
  const localizacao = useLocation()
  const navegar = useNavigate()
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    const texto = (localizacao.state as { flash?: string } | null)?.flash
    if (!texto) return
    setFlash(texto)
    navegar(localizacao.pathname, { replace: true, state: {} })
  }, [localizacao.pathname, localizacao.state, navegar])

  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 4000)
    return () => window.clearTimeout(t)
  }, [flash])

  const limparFlash = useCallback(() => setFlash(null), [])

  return { flash, setFlash, limparFlash }
}
