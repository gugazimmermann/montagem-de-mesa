import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Cliente, DadosCliente } from '../../compartilhado/tipos'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import * as ui from './adminClasses'

type Props = {
  cliente: Cliente | null | undefined
  dados: DadosCliente
  linkPublico: string
  aoAbrirAjuda?: () => void
}

function chaveDismiss(clienteId: string) {
  return `onboarding-dismiss:${clienteId}`
}

export function AdminOnboarding({ cliente, dados, linkPublico, aoAbrirAjuda }: Props) {
  const clienteId = cliente?.id
  const [dismissed, setDismissed] = useState(() => {
    if (!clienteId) return true
    try {
      return localStorage.getItem(chaveDismiss(clienteId)) === '1'
    } catch {
      return false
    }
  })

  const passos = useMemo(() => {
    const temLogo = Boolean(cliente?.logo?.trim())
    const temWhatsapp = (cliente?.whatsapp?.replace(/\D/g, '').length ?? 0) >= 12
    const catsEditaveis = dados.categorias.filter((c) => !ehCategoriaFixa(c.id))
    const temCategoria = catsEditaveis.length > 0
    const temItem = dados.itens.some((i) => !ehCategoriaFixa(i.categoria))
    return [
      {
        id: 'logo',
        rotulo: 'Adicionar logo',
        feito: temLogo,
        para: '/admin/painel/cadastro',
      },
      {
        id: 'whatsapp',
        rotulo: 'Cadastrar WhatsApp',
        feito: temWhatsapp,
        para: '/admin/painel/cadastro',
      },
      {
        id: 'categoria',
        rotulo: 'Criar uma categoria',
        feito: temCategoria,
        para: '/admin/painel/categorias/novo',
      },
      {
        id: 'item',
        rotulo: 'Cadastrar um item',
        feito: temItem,
        para: temCategoria
          ? `/admin/painel/categorias/${catsEditaveis[0]!.id}/itens/novo`
          : '/admin/painel/categorias/novo',
      },
      {
        id: 'link',
        rotulo: 'Abrir página pública',
        feito: false,
        para: linkPublico,
        externo: true,
      },
    ] as const
  }, [cliente?.logo, cliente?.whatsapp, dados.categorias, dados.itens, linkPublico])

  const pendentes = passos.filter((p) => p.id !== 'link' && !p.feito)
  if (!clienteId || dismissed || pendentes.length === 0) return null

  function dispensar() {
    try {
      localStorage.setItem(chaveDismiss(clienteId!), '1')
    } catch {
      // ignora storage
    }
    setDismissed(true)
  }

  return (
    <section className={ui.painelSecao} aria-label="Primeiros passos">
      <div className={ui.itensCabecalho}>
        <h2>Primeiros passos</h2>
        <div className="flex flex-wrap gap-1.5">
          {aoAbrirAjuda ? (
            <button type="button" className="btn btn--ghost" onClick={aoAbrirAjuda}>
              Saiba mais
            </button>
          ) : null}
          <button type="button" className="btn btn--ghost" onClick={dispensar}>
            Dispensar
          </button>
        </div>
      </div>
      <p className="m-0 mb-2 text-sm text-muted">
        Complete o checklist para deixar a montagem pronta durante o período de avaliação.
      </p>
      <ul className={ui.onboardingLista}>
        {passos.map((passo) => (
          <li key={passo.id} className={ui.onboardingItem}>
            <span>
              {passo.feito ? (
                <span className={ui.onboardingFeito}>Concluído — </span>
              ) : null}
              {passo.rotulo}
            </span>
            {!passo.feito && (
              <Link
                className="btn btn--ghost"
                to={passo.para}
                {...('externo' in passo && passo.externo
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                Ir
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
