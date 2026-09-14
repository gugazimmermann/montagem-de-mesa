import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import * as ui from './adminClasses'

export type TipoAlerta = 'info' | 'success' | 'warning' | 'error'

type PropsAdminAlerta = {
  tipo: TipoAlerta
  titulo?: string
  children: ReactNode
}

export function AdminAlerta({ tipo, titulo, children }: PropsAdminAlerta) {
  const role = tipo === 'error' ? 'alert' : 'status'
  return (
    <div className={ui.alertaPorTipo[tipo]} role={role}>
      {titulo && <p className={ui.alertaTituloPorTipo[tipo]}>{titulo}</p>}
      <div className={tipo === 'error' ? ui.alertaCorpoErro : ui.alertaCorpo}>
        {children}
      </div>
    </div>
  )
}

type PropsAdminEstado = {
  mensagem?: string
}

export function AdminEstadoCarregando({
  mensagem = 'Carregando…',
}: PropsAdminEstado) {
  return (
    <div className={ui.estado} role="status" aria-live="polite" aria-busy="true">
      <span className={ui.estadoSpinner} aria-hidden="true" />
      <p>{mensagem}</p>
    </div>
  )
}

type PropsAdminSkeleton = {
  linhas?: number
  mensagem?: string
}

export function AdminEstadoSkeleton({
  linhas = 4,
  mensagem = 'Carregando…',
}: PropsAdminSkeleton) {
  return (
    <div className={ui.estado} role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">{mensagem}</p>
      <div className={ui.skeleton} aria-hidden="true">
        <div className={ui.skeletonLinhaCurta} />
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className={ui.skeletonLinha} />
        ))}
      </div>
    </div>
  )
}

type PropsAdminEstadoVazio = {
  titulo: string
  descricao?: string
  acao?: ReactNode
}

export function AdminEstadoVazio({
  titulo,
  descricao,
  acao,
}: PropsAdminEstadoVazio) {
  return (
    <div className={ui.estadoVazio}>
      <p className={ui.estadoTitulo}>{titulo}</p>
      {descricao && <p className={ui.estadoDesc}>{descricao}</p>}
      {acao}
    </div>
  )
}

type PropsAdminBreadcrumb = {
  itens: { rotulo: string; para?: string }[]
}

export function AdminBreadcrumb({ itens }: PropsAdminBreadcrumb) {
  return (
    <nav className={ui.breadcrumb} aria-label="Navegação">
      <ol className={ui.breadcrumbList}>
        {itens.map((item, i) => (
          <li key={`${item.rotulo}-${i}`} className="flex items-center gap-[0.35rem]">
            {item.para ? (
              <Link className={ui.breadcrumbLink} to={item.para}>
                {item.rotulo}
              </Link>
            ) : (
              <span className={ui.breadcrumbAtual} aria-current="page">
                {item.rotulo}
              </span>
            )}
            {i < itens.length - 1 ? <span className="opacity-60">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  )
}
