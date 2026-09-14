import { useInfiniteQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { MontagemEnviada } from '../../compartilhado/tipos'
import { formatarWhatsapp } from '../../dados/repositorioClientes'
import {
  listarMontagensEnviadas,
  MONTAGENS_PAGE_SIZE,
} from '../../dados/repositorioMontagens'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { montagensQueryKey } from './useDadosCliente'
import * as ui from './adminClasses'

function formatarDataHora(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function resumoItens(itens: MontagemEnviada['itens']): string {
  if (itens.length === 0) return 'Sem itens'
  if (itens.length === 1) return itens[0]!.nome
  return `${itens.length} itens · ${itens[0]!.nome}`
}

export function HistoricoMontagensAdmin() {
  const { cliente } = useAuth()
  const clienteId = cliente?.id
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const query = useInfiniteQuery({
    queryKey: clienteId ? montagensQueryKey(clienteId) : ['montagens', 'none'],
    queryFn: ({ pageParam }) =>
      listarMontagensEnviadas(clienteId!, {
        offset: pageParam,
        limit: MONTAGENS_PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) =>
      ultima.temMais ? todas.length * MONTAGENS_PAGE_SIZE : undefined,
    enabled: Boolean(clienteId),
    staleTime: 30_000,
  })

  if (!clienteId) return <AdminSessaoInvalida />
  if (query.isLoading) {
    return <AdminPainelCarregando mensagem="Carregando montagens…" />
  }

  const lista = query.data?.pages.flatMap((p) => p.itens) ?? []
  const erro = query.isError
    ? 'Não foi possível carregar as montagens enviadas.'
    : null

  return (
    <AdminPaginaPainel
      titulo="Montagens enviadas"
      breadcrumb={[
        { rotulo: 'Painel', para: '/admin/painel' },
        { rotulo: 'Montagens enviadas' },
      ]}
      voltarPara="/admin/painel"
      alerta={
        erro ? (
          <AdminAlerta tipo="error" titulo="Erro">
            {erro}
          </AdminAlerta>
        ) : null
      }
    >
      {lista.length === 0 ? (
        <AdminEstadoVazio
          titulo="Nenhuma montagem ainda"
          descricao="Quando um visitante enviar a montagem pela página pública, ela aparecerá aqui com os dados de contato."
        />
      ) : (
        <>
          <ul className={ui.historicoLista}>
            {lista.map((m) => {
              const aberto = expandidoId === m.id
              return (
                <li key={m.id} className={ui.historicoCard}>
                  <div className={ui.historicoTopo}>
                    <div>
                      <p className={ui.historicoData}>
                        {formatarDataHora(m.createdAt)}
                      </p>
                      <h2 className={ui.historicoNome}>{m.visitanteNome}</h2>
                      <p className={ui.historicoMeta}>
                        {m.visitanteCidade}/{m.visitanteEstado} ·{' '}
                        {resumoItens(m.itens)}
                      </p>
                    </div>
                    <div className={ui.historicoAcoes}>
                      <a
                        className="btn btn--ghost"
                        href={m.linkMontagem}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir montagem
                      </a>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        aria-expanded={aberto}
                        onClick={() =>
                          setExpandidoId((id) => (id === m.id ? null : m.id))
                        }
                      >
                        {aberto ? 'Ocultar detalhes' : 'Ver detalhes'}
                      </button>
                    </div>
                  </div>

                  {aberto && (
                    <div className={ui.historicoDetalhe}>
                      <dl className={ui.historicoDl}>
                        <div className={ui.historicoDlItem}>
                          <dt className={ui.historicoDt}>E-mail</dt>
                          <dd className={ui.historicoDd}>
                            <a href={`mailto:${m.visitanteEmail}`}>
                              {m.visitanteEmail}
                            </a>
                          </dd>
                        </div>
                        <div className={ui.historicoDlItem}>
                          <dt className={ui.historicoDt}>WhatsApp</dt>
                          <dd className={ui.historicoDd}>
                            <a
                              href={`https://wa.me/${m.visitanteWhatsapp.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {formatarWhatsapp(m.visitanteWhatsapp) ||
                                m.visitanteWhatsapp}
                            </a>
                          </dd>
                        </div>
                        <div className={ui.historicoDlItem}>
                          <dt className={ui.historicoDt}>Endereço</dt>
                          <dd className={ui.historicoDd}>
                            {m.visitanteEndereco}, {m.visitanteCidade} —{' '}
                            {m.visitanteEstado}
                          </dd>
                        </div>
                      </dl>
                      <h3>Itens</h3>
                      <ul className={ui.historicoItens}>
                        {m.itens.map((item) => (
                          <li
                            key={`${item.categoria}:${item.nome}`}
                            className={ui.historicoItemLi}
                          >
                            <span className={ui.historicoCat}>{item.categoria}</span>
                            <span>{item.nome}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {query.hasNextPage && (
            <p className={ui.historicoRodape}>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
              </button>
            </p>
          )}
        </>
      )}
    </AdminPaginaPainel>
  )
}
