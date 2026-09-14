import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ConfiguracaoMesa, DadosCliente } from '../../compartilhado/tipos'
import { criarConfiguracaoVazia } from '../catalogo'
import {
  lerMontagemDaUrl,
  mesmaMontagem,
  urlComMontagem,
} from './montagemUrl'

const DEBOUNCE_MS = 150

function montagemDeDados(
  search: string,
  categorias: DadosCliente['categorias'],
  itens: DadosCliente['itens'],
): ConfiguracaoMesa {
  return lerMontagemDaUrl(search, categorias, itens) ?? criarConfiguracaoVazia(categorias)
}

/** Sync bidirecional `?m=` ↔ estado, com debounce na escrita. */
export function useMontagemNaUrl(
  categorias: DadosCliente['categorias'],
  itens: DadosCliente['itens'],
) {
  const localizacao = useLocation()
  const navegar = useNavigate()
  const [configuracao, setConfiguracao] = useState<ConfiguracaoMesa>(() =>
    montagemDeDados(localizacao.search, categorias, itens),
  )
  const ignorarProximaUrlRef = useRef(false)
  const debounceRef = useRef<number | null>(null)
  const categoriasKey = categorias.map((c) => c.id).join(',')

  // URL → estado (back/forward / link compartilhado)
  useEffect(() => {
    if (ignorarProximaUrlRef.current) {
      ignorarProximaUrlRef.current = false
      return
    }
    const daUrl = montagemDeDados(localizacao.search, categorias, itens)
    setConfiguracao((anterior) => (mesmaMontagem(anterior, daUrl) ? anterior : daUrl))
  }, [localizacao.search, categoriasKey, categorias, itens])

  // Estado → URL (debounce)
  useEffect(() => {
    if (debounceRef.current != null) {
      window.clearTimeout(debounceRef.current)
    }

    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      const caminho = urlComMontagem(localizacao.pathname, configuracao)
      const atual = `${localizacao.pathname}${localizacao.search}`
      if (caminho === atual) return
      if (caminho === localizacao.pathname && !localizacao.search) return
      ignorarProximaUrlRef.current = true
      navegar(caminho, { replace: true })
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current)
      }
    }
  }, [configuracao, localizacao.pathname, localizacao.search, navegar])

  return { configuracao, setConfiguracao, localizacao, navegar }
}
