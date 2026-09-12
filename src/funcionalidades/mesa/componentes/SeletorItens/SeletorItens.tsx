import { useEffect, type CSSProperties, type KeyboardEvent } from 'react'
import type { Categoria, ConfiguracaoMesa, IdCategoria, ItemMesa } from '../../../../compartilhado/tipos'
import { ehCategoriaFixa } from '../../../../dados/categoriasFixas'
import { obterItensPorCategoria } from '../../../catalogo'
import './SeletorItens.css'
import '../../padroes-tecido.css'

interface PropsSeletorItens {
  categorias: Categoria[]
  itens: ItemMesa[]
  categoriaAtiva: IdCategoria
  configuracao: ConfiguracaoMesa
  aoMudarCategoria: (categoria: IdCategoria) => void
  aoSelecionar: (categoria: IdCategoria, idItem: string | null) => void
}

function AmostraItem({ item }: { item: ItemMesa }) {
  if (item.imagem) {
    return (
      <span className="item-card__swatch item-card__swatch--image" aria-hidden="true">
        <img src={item.imagem} alt="" loading="lazy" />
      </span>
    )
  }

  const { primaria, secundaria = primaria, destaque = primaria } = item.cores
  const padrao = item.padrao ?? 'solid'

  return (
    <span
      className={`item-card__swatch item-card__swatch--fabric padrao--${padrao}`}
      style={
        {
          '--c-primary': primaria,
          '--c-secondary': secundaria,
          '--c-accent': destaque,
        } as CSSProperties
      }
      aria-hidden="true"
    />
  )
}

export function SeletorItens({
  categorias,
  itens,
  categoriaAtiva,
  configuracao,
  aoMudarCategoria,
  aoSelecionar,
}: PropsSeletorItens) {
  const itensCategoria = obterItensPorCategoria(itens, categoriaAtiva)
  const metaAtiva = categorias.find((c) => c.id === categoriaAtiva)
  const idSelecionado = configuracao[categoriaAtiva]
  const painelId = 'item-picker-panel'

  useEffect(() => {
    if (!categoriaAtiva) return
    document
      .getElementById(`tab-${categoriaAtiva}`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
  }, [categoriaAtiva])

  function aoTeclaTab(evento: KeyboardEvent<HTMLDivElement>) {
    const atual = categorias.findIndex((c) => c.id === categoriaAtiva)
    if (atual < 0) return

    let proximo = atual
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      proximo = (atual + 1) % categorias.length
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      proximo = (atual - 1 + categorias.length) % categorias.length
    } else if (evento.key === 'Home') {
      proximo = 0
    } else if (evento.key === 'End') {
      proximo = categorias.length - 1
    } else {
      return
    }

    evento.preventDefault()
    const id = categorias[proximo]?.id
    if (id) {
      aoMudarCategoria(id)
      // Roving tabindex: move o foco para a aba recém-ativada.
      window.requestAnimationFrame(() => {
        document.getElementById(`tab-${id}`)?.focus()
      })
    }
  }

  return (
    <div className="item-picker">
      <div
        className="item-picker__tabs"
        role="tablist"
        aria-label="Categorias"
        onKeyDown={aoTeclaTab}
      >
        {categorias.map((categoria) => {
          const ativa = categoria.id === categoriaAtiva
          const temSelecao = Boolean(configuracao[categoria.id])
          const ilustrativa = ehCategoriaFixa(categoria.id)

          return (
            <button
              key={categoria.id}
              type="button"
              role="tab"
              id={`tab-${categoria.id}`}
              className={`item-picker__tab ${ativa ? 'is-active' : ''} ${temSelecao ? 'has-selection' : ''} ${ilustrativa ? 'is-illustrative' : ''}`}
              onClick={() => aoMudarCategoria(categoria.id)}
              aria-selected={ativa}
              aria-controls={painelId}
              tabIndex={ativa ? 0 : -1}
              title={ilustrativa ? 'Somente ilustrativo — ambientação' : undefined}
              aria-label={
                temSelecao
                  ? `${categoria.rotulo}, com seleção${ilustrativa ? ', ambientação' : ''}`
                  : ilustrativa
                    ? `${categoria.rotulo}, ambientação`
                    : undefined
              }
            >
              {categoria.rotulo}
              {ilustrativa && <span className="item-picker__tab-hint">ambientação</span>}
              {temSelecao && (
                <span className="visually-hidden"> (selecionado)</span>
              )}
            </button>
          )
        })}
      </div>

      <div
        className="item-picker__panel"
        role="tabpanel"
        id={painelId}
        aria-labelledby={metaAtiva ? `tab-${metaAtiva.id}` : undefined}
      >
        <header className="item-picker__header">
          <div>
            <h2>{metaAtiva?.rotulo}</h2>
            <p>{metaAtiva?.descricao}</p>
          </div>
          {idSelecionado && (
            <button
              type="button"
              className="item-picker__clear"
              onClick={() => aoSelecionar(categoriaAtiva, null)}
            >
              Remover
            </button>
          )}
        </header>

        {itensCategoria.length === 0 ? (
          <p className="item-picker__empty">Nenhum item nesta categoria.</p>
        ) : (
          <ul className="item-picker__grid">
            {itensCategoria.map((item) => {
              const selecionado = idSelecionado === item.id

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`item-card ${selecionado ? 'is-selected' : ''}`}
                    onClick={() => aoSelecionar(categoriaAtiva, item.id)}
                    aria-pressed={selecionado}
                  >
                    <AmostraItem item={item} />
                    <span className="item-card__body">
                      <span className="item-card__name">{item.nome}</span>
                      {item.descricao && (
                        <span className="item-card__desc">{item.descricao}</span>
                      )}
                    </span>
                    {selecionado && (
                      <span className="item-card__check" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
