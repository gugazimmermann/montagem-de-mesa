import {
  QueryClient,
  useQuery,
  useQueryClient,
  type QueryClient as QueryClientType,
} from '@tanstack/react-query'
import type { DadosCliente } from '../../compartilhado/tipos'
import { carregarDadosCliente } from '../../dados/repositorioClientes'

export const catalogoQueryKey = (clienteId: string) =>
  ['catalogo', clienteId] as const

export const montagensQueryKey = (clienteId: string) =>
  ['montagens', clienteId] as const

export function invalidarCatalogo(
  queryClient: QueryClientType,
  clienteId: string,
) {
  return queryClient.invalidateQueries({ queryKey: catalogoQueryKey(clienteId) })
}

export function useDadosCliente(clienteId: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: clienteId ? catalogoQueryKey(clienteId) : ['catalogo', 'none'],
    queryFn: async () => {
      const dados = await carregarDadosCliente(clienteId!)
      if (!dados) throw new Error('Conta não encontrada.')
      return dados
    },
    enabled: Boolean(clienteId),
    staleTime: 45_000,
  })

  function setDados(
    updater: DadosCliente | null | ((prev: DadosCliente | null) => DadosCliente | null),
  ) {
    if (!clienteId) return
    queryClient.setQueryData<DadosCliente>(catalogoQueryKey(clienteId), (atual) => {
      const prev = atual ?? null
      const proximo = typeof updater === 'function' ? updater(prev) : updater
      return proximo ?? undefined
    })
  }

  return {
    dados: query.data ?? null,
    setDados,
    carregando: Boolean(clienteId) && query.isLoading,
    erro: query.isError
      ? query.error instanceof Error
        ? query.error.message
        : 'Não foi possível carregar os dados.'
      : null,
    setErro: (_: string | null) => {
      /* React Query owns error state; kept for API compat */
    },
    refetch: query.refetch,
  }
}

export function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  })
}
