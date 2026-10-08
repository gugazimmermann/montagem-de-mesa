import { useQuery } from '@tanstack/react-query'
import { carregarResumoFunil, taxaEnvio } from '../../dados/repositorioFunil'

function formatarTaxa(valor: number | null): string {
  if (valor == null) return '—'
  return `${Math.round(valor * 100)}%`
}

function textoNumero(valor: number | null | undefined, carregando: boolean): string {
  if (carregando || valor === undefined) return '…'
  if (valor == null) return '—'
  return String(valor)
}

export function ResumoFunilAdmin({ clienteId }: { clienteId: string }) {
  const query = useQuery({
    queryKey: ['funil', clienteId],
    queryFn: () => carregarResumoFunil(clienteId),
    staleTime: 60_000,
  })

  const resumo = query.data
  const carregando = query.isLoading && !resumo

  return (
    <section className="mb-4" aria-label="Resumo da página pública">
      <h2 className="mb-2 mt-0 font-display text-base font-semibold">Últimos acessos</h2>
      {query.isError ? (
        <p className="m-0 text-sm text-muted">Não foi possível carregar o resumo.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <article className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="m-0 text-xs text-muted">Visitas</p>
            <p className="m-0 text-lg font-semibold">
              {textoNumero(resumo?.visitas7, carregando)}
              <span className="ml-2 text-xs font-normal text-muted">
                7 dias · {textoNumero(resumo?.visitas30, carregando)} em 30
              </span>
            </p>
          </article>
          <article className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="m-0 text-xs text-muted">Montagens enviadas</p>
            <p className="m-0 text-lg font-semibold">
              {textoNumero(resumo?.envios7, carregando)}
              <span className="ml-2 text-xs font-normal text-muted">
                7 dias · {textoNumero(resumo?.envios30, carregando)} em 30
              </span>
            </p>
          </article>
          <article className="rounded-md border border-border bg-surface px-3 py-2">
            <p className="m-0 text-xs text-muted">Taxa de envio</p>
            <p className="m-0 text-lg font-semibold">
              {carregando
                ? '…'
                : formatarTaxa(taxaEnvio(resumo?.envios7 ?? 0, resumo?.visitas7 ?? null))}
              <span className="ml-2 text-xs font-normal text-muted">
                7 dias ·{' '}
                {carregando
                  ? '…'
                  : formatarTaxa(taxaEnvio(resumo?.envios30 ?? 0, resumo?.visitas30 ?? null))}{' '}
                em 30
              </span>
            </p>
          </article>
        </div>
      )}
    </section>
  )
}
