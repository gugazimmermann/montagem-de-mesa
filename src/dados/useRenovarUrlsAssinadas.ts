import { useEffect, useRef } from 'react'
import type { DadosCliente } from '../compartilhado/tipos'
import { renovarUrlsAssinadas } from './repositorioClientes'
import { INTERVALO_REASSINAR_MS } from './storage'

const VERIFICAR_MS = 60_000

/**
 * Troca só as URLs assinadas, sem buscar o catálogo de novo.
 * Se a assinatura falhar, a callback não roda e as imagens atuais permanecem.
 */
export function useRenovarUrlsAssinadas(
  dados: DadosCliente | null,
  aoAtualizar: (dados: DadosCliente) => void,
) {
  const dadosRef = useRef(dados)
  const atualizarRef = useRef(aoAtualizar)
  dadosRef.current = dados
  atualizarRef.current = aoAtualizar

  useEffect(() => {
    let ultimo = Date.now()
    let ocupado = false

    const renovar = () => {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - ultimo < INTERVALO_REASSINAR_MS) return
      const atual = dadosRef.current
      if (!atual || ocupado) return
      ocupado = true
      void renovarUrlsAssinadas(atual)
        .then((novos) => {
          if (novos === atual) {
            ultimo = Date.now() - INTERVALO_REASSINAR_MS + 15 * 60 * 1000
            return
          }
          ultimo = Date.now()
          atualizarRef.current(novos)
        })
        .catch(() => {
          // Mantém as URLs que ainda estão na tela.
        })
        .finally(() => {
          ocupado = false
        })
    }

    const timer = window.setInterval(renovar, VERIFICAR_MS)
    document.addEventListener('visibilitychange', renovar)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', renovar)
    }
  }, [])
}
