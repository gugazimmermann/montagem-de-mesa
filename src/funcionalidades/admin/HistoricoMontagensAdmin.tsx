import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MontagemEnviada } from '../../compartilhado/tipos'
import { formatarWhatsapp } from '../../dados/repositorioClientes'
import { listarMontagensEnviadas } from '../../dados/repositorioMontagens'
import { useAuth } from '../autenticacao'
import { AdminAlerta, AdminEstadoVazio } from './AdminFeedback'
import {
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
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

  const [lista, setLista] = useState<MontagemEnviada[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  useEffect(() => {
    if (!clienteId) return
    let ativo = true

    async function carregar() {
      setErro(null)
      try {
        const dados = await listarMontagensEnviadas(clienteId!)
        if (ativo) setLista(dados)
      } catch {
        if (ativo) {
          setLista(null)
          setErro('Não foi possível carregar as montagens enviadas.')
        }
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [clienteId])

  if (!clienteId) return <AdminSessaoInvalida />
  if (lista === null && !erro) {
    return <AdminPainelCarregando mensagem="Carregando montagens…" />
  }

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
      {!lista || lista.length === 0 ? (
        <AdminEstadoVazio
          titulo="Nenhuma montagem ainda"
          descricao="Quando um visitante enviar a montagem pela página pública, ela aparecerá aqui com os dados de contato."
        />
      ) : (
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
                      {m.visitanteCidade}/{m.visitanteEstado} · {resumoItens(m.itens)}
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
                          <a href={`mailto:${m.visitanteEmail}`}>{m.visitanteEmail}</a>
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
                        <li key={`${item.categoria}:${item.nome}`} className={ui.historicoItemLi}>
                          <span className={ui.historicoCat}>
                            {item.categoria}
                          </span>
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
      )}

      <p className={ui.historicoRodape}>
        <Link to="/admin/painel">Voltar ao painel</Link>
      </p>
    </AdminPaginaPainel>
  )
}
