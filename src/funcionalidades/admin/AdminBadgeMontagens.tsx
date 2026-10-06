import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { contarMontagensNovas } from '../../dados/repositorioMontagens'
import { useAuth } from '../autenticacao'
import { montagensQueryKey } from './useDadosCliente'

/** Badge de leads novos — aparece em qualquer página do painel. */
export function AdminBadgeMontagens() {
  const { cliente } = useAuth()
  const clienteId = cliente?.id

  const query = useQuery({
    queryKey: clienteId
      ? [...montagensQueryKey(clienteId), 'count-novos']
      : ['montagens', 'none', 'count'],
    queryFn: () => contarMontagensNovas(clienteId!),
    enabled: Boolean(clienteId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const qtd = query.data ?? 0
  if (qtd <= 0) return null

  return (
    <Link
      className="btn btn--ghost relative inline-flex items-center gap-1.5"
      to="/admin/painel/montagens"
      title={`${qtd} montagem${qtd === 1 ? '' : 'ens'} nova${qtd === 1 ? '' : 's'}`}
    >
      Montagens
      <span
        className="inline-flex min-w-[1.25rem] items-center justify-center rounded-sm bg-accent px-1.5 py-0.5 text-[0.7rem] font-semibold leading-none text-white"
        aria-label={`${qtd} novas`}
      >
        {qtd > 99 ? '99+' : qtd}
      </span>
    </Link>
  )
}
