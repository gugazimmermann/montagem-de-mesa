import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type {
  MontagemEnviada,
  StatusLeadMontagem,
} from '../../compartilhado/tipos'
import { formatarWhatsapp } from '../../dados/repositorioClientes'
import {
  atualizarLeadMontagem,
  contarMontagensNovas,
  listarMontagensEnviadas,
  MONTAGENS_PAGE_SIZE,
  reenviarEmailMontagem,
} from '../../dados/repositorioMontagens'
import { linkAbrirMontagemAdmin } from '../mesa/montagemUrl'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { montagensQueryKey, useDadosCliente } from './useDadosCliente'
import * as ui from './adminClasses'

const LEAD_OPCOES: { valor: StatusLeadMontagem; rotulo: string }[] = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'contatado', rotulo: 'Contatado' },
  { valor: 'fechado', rotulo: 'Fechado' },
  { valor: 'arquivado', rotulo: 'Arquivado' },
]

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
  if (itens.length === 1) return '1 item'
  return `${itens.length} itens`
}

function classeBadgeLead(status: StatusLeadMontagem): string {
  switch (status) {
    case 'novo':
      return ui.historicoBadgeNovo
    case 'contatado':
      return ui.historicoBadgeContatado
    case 'fechado':
      return ui.historicoBadgeFechado
    default:
      return ui.historicoBadgeArquivado
  }
}

export function HistoricoMontagensAdmin() {
  const { cliente } = useAuth()
  const clienteId = cliente?.id
  const slug = cliente?.slug ?? ''
  const queryClient = useQueryClient()
  const { dados: catalogo, carregando: carregandoCatalogo } =
    useDadosCliente(clienteId)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusLeadMontagem | 'todos'>(
    'todos',
  )
  const [salvandoId, setSalvandoId] = useState<string | null>(null)
  const [reenviandoId, setReenviandoId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [notasLocais, setNotasLocais] = useState<Record<string, string>>({})

  const filtros = useMemo(
    () => ({ busca: buscaAplicada, leadStatus: filtroStatus }),
    [buscaAplicada, filtroStatus],
  )

  const query = useInfiniteQuery({
    queryKey: clienteId
      ? [...montagensQueryKey(clienteId), filtros]
      : ['montagens', 'none'],
    queryFn: ({ pageParam }) =>
      listarMontagensEnviadas(clienteId!, {
        offset: pageParam,
        limit: MONTAGENS_PAGE_SIZE,
        busca: filtros.busca || undefined,
        leadStatus: filtros.leadStatus,
      }),
    initialPageParam: 0,
    getNextPageParam: (ultima, todas) =>
      ultima.temMais ? todas.length * MONTAGENS_PAGE_SIZE : undefined,
    enabled: Boolean(clienteId),
    staleTime: 30_000,
  })

  const queryNovos = useQuery({
    queryKey: clienteId
      ? [...montagensQueryKey(clienteId), 'count-novos']
      : ['montagens', 'none', 'count'],
    queryFn: () => contarMontagensNovas(clienteId!),
    enabled: Boolean(clienteId),
    staleTime: 30_000,
  })

  if (!clienteId) return <AdminSessaoInvalida />
  if (query.isLoading || carregandoCatalogo) {
    return <AdminPainelCarregando mensagem="Carregando montagens…" />
  }

  const lista = query.data?.pages.flatMap((p) => p.itens) ?? []
  const categorias = catalogo?.categorias ?? []
  const itensCatalogo = catalogo?.itens ?? []
  const erro = query.isError
    ? 'Não foi possível carregar as montagens enviadas.'
    : null

  function hrefAbrirMontagem(m: MontagemEnviada): string {
    if (!slug) return m.linkMontagem
    return linkAbrirMontagemAdmin({
      slug,
      linkSalvo: m.linkMontagem,
      itensEnviados: m.itens,
      categorias,
      itensCatalogo,
    })
  }

  async function invalidar() {
    await queryClient.invalidateQueries({
      queryKey: montagensQueryKey(clienteId!),
    })
  }

  async function aoMudarStatus(m: MontagemEnviada, leadStatus: StatusLeadMontagem) {
    setSalvandoId(m.id)
    setErroAcao(null)
    try {
      await atualizarLeadMontagem(clienteId!, m.id, { leadStatus })
      setFeedback('Status atualizado.')
      await invalidar()
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível atualizar.')
    } finally {
      setSalvandoId(null)
    }
  }

  async function aoSalvarNota(m: MontagemEnviada) {
    const nota = notasLocais[m.id] ?? m.notaInterna
    setSalvandoId(m.id)
    setErroAcao(null)
    try {
      await atualizarLeadMontagem(clienteId!, m.id, { notaInterna: nota })
      setFeedback('Nota salva.')
      await invalidar()
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível salvar a nota.')
    } finally {
      setSalvandoId(null)
    }
  }

  async function aoReenviar(m: MontagemEnviada) {
    setReenviandoId(m.id)
    setErroAcao(null)
    try {
      await reenviarEmailMontagem(m.id)
      setFeedback('E-mail reenviado.')
      await invalidar()
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Falha ao reenviar e-mail.')
    } finally {
      setReenviandoId(null)
    }
  }

  const qtdNovos = queryNovos.data ?? 0

  return (
    <AdminPaginaPainel
      titulo="Montagens enviadas"
      breadcrumb={[
        { rotulo: 'Painel', para: '/admin/painel' },
        { rotulo: 'Montagens enviadas' },
      ]}
      voltarPara="/admin/painel"
      alerta={
        <>
          {erro ? (
            <AdminAlerta tipo="error" titulo="Erro">
              {erro}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => void query.refetch()}
              >
                Tentar novamente
              </button>
            </AdminAlerta>
          ) : null}
          {erroAcao ? (
            <AdminAlerta tipo="error" titulo="Atenção">
              {erroAcao}
            </AdminAlerta>
          ) : null}
          {feedback ? (
            <AdminAlerta tipo="success" titulo="Pronto">
              {feedback}
            </AdminAlerta>
          ) : null}
          {qtdNovos > 0 ? (
            <AdminAlerta tipo="info" titulo="Novos leads">
              {qtdNovos === 1
                ? 'Há 1 montagem nova aguardando atendimento.'
                : `Há ${qtdNovos} montagens novas aguardando atendimento.`}
            </AdminAlerta>
          ) : null}
        </>
      }
    >
      <div className={ui.historicoFiltros}>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Buscar</span>
          <input
            className={ui.fieldInput}
            type="search"
            placeholder="Nome, e-mail, cidade…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setBuscaAplicada(busca.trim())
            }}
          />
        </label>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>Status</span>
          <select
            className={ui.fieldInput}
            value={filtroStatus}
            onChange={(e) =>
              setFiltroStatus(e.target.value as StatusLeadMontagem | 'todos')
            }
          >
            <option value="todos">Todos</option>
            {LEAD_OPCOES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <div className={ui.historicoFiltrosAcoes}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setBuscaAplicada(busca.trim())}
          >
            Filtrar
          </button>
        </div>
      </div>

      {lista.length === 0 ? (
        <AdminEstadoVazio
          titulo="Nenhuma montagem ainda"
          descricao={
            buscaAplicada || filtroStatus !== 'todos'
              ? 'Nenhum resultado para estes filtros.'
              : 'Quando um visitante enviar a montagem pela página pública, ela aparecerá aqui com os dados de contato.'
          }
        />
      ) : (
        <>
          <ul className={ui.historicoLista}>
            {lista.map((m) => {
              const aberto = expandidoId === m.id
              const nota = notasLocais[m.id] ?? m.notaInterna
              return (
                <li key={m.id} className={ui.historicoCard}>
                  <div className={ui.historicoTopo}>
                    <div>
                      <p className={ui.historicoData}>
                        {formatarDataHora(m.createdAt)}
                      </p>
                      <h2 className={ui.historicoNome}>
                        {m.visitanteNome}{' '}
                        <span className={classeBadgeLead(m.leadStatus)}>
                          {LEAD_OPCOES.find((o) => o.valor === m.leadStatus)?.rotulo}
                        </span>
                      </h2>
                      <p className={ui.historicoMeta}>
                        {m.visitanteCidade}/{m.visitanteEstado} ·{' '}
                        {resumoItens(m.itens)}
                      </p>
                    </div>
                    <div className={ui.historicoAcoes}>
                      <a
                        className="btn btn--ghost"
                        href={hrefAbrirMontagem(m)}
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
                        <div className={ui.historicoDlItem}>
                          <dt className={ui.historicoDt}>Status do lead</dt>
                          <dd className={ui.historicoDd}>
                            <select
                              className={ui.fieldInput}
                              value={m.leadStatus}
                              disabled={salvandoId === m.id}
                              onChange={(e) =>
                                void aoMudarStatus(
                                  m,
                                  e.target.value as StatusLeadMontagem,
                                )
                              }
                            >
                              {LEAD_OPCOES.map((o) => (
                                <option key={o.valor} value={o.valor}>
                                  {o.rotulo}
                                </option>
                              ))}
                            </select>
                          </dd>
                        </div>
                        <div className={ui.historicoDlItem}>
                          <dt className={ui.historicoDt}>Nota interna</dt>
                          <dd className={ui.historicoDd}>
                            <textarea
                              className={ui.fieldInput}
                              rows={3}
                              maxLength={2000}
                              value={nota}
                              onChange={(e) =>
                                setNotasLocais((prev) => ({
                                  ...prev,
                                  [m.id]: e.target.value,
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="btn btn--ghost"
                              disabled={salvandoId === m.id}
                              onClick={() => void aoSalvarNota(m)}
                            >
                              Salvar nota
                            </button>
                          </dd>
                        </div>
                      </dl>
                      {(m.emailStatus === 'failed' ||
                        m.emailStatus === 'pending') && (
                        <p className={ui.historicoRodape}>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={reenviandoId === m.id}
                            onClick={() => void aoReenviar(m)}
                          >
                            {reenviandoId === m.id
                              ? 'Reenviando…'
                              : 'Reenviar e-mail'}
                          </button>
                        </p>
                      )}
                      <h3>Itens</h3>
                      <ul className={ui.historicoItens}>
                        {m.itens.map((item, idx) => (
                          <li
                            key={`${m.id}-${idx}-${item.categoria}-${item.nome}`}
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
