import type { CSSProperties } from 'react'
import type { Categoria, ConfiguracaoMesa, IdCategoria, ItemMesa } from '../../../../compartilhado/tipos'
import { ehCategoriaFixa } from '../../../../dados/categoriasFixas'
import { obterItensPorCategoria } from '../../../catalogo'
import './SeletorItens.css'

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
        <img src={item.imagem} alt="" />
      </span>
    )
  }

  const { primaria, secundaria = primaria, destaque = primaria } = item.cores
  const padrao = item.padrao ?? 'solid'

  return (
    <span
      className={`item-card__swatch item-card__swatch--fabric item-card__swatch--${padrao}`}
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

  return (
    <div className="item-picker">
      <nav className="item-picker__tabs" aria-label="Categorias de louça">
        {categorias.map((categoria) => {
          const ativa = categoria.id === categoriaAtiva
          const temSelecao = Boolean(configuracao[categoria.id])
          const ilustrativa = ehCategoriaFixa(categoria.id)

          return (
            <button
              key={categoria.id}
              type="button"
              className={`item-picker__tab ${ativa ? 'is-active' : ''} ${temSelecao ? 'has-selection' : ''} ${ilustrativa ? 'is-illustrative' : ''}`}
              onClick={() => aoMudarCategoria(categoria.id)}
              aria-pressed={ativa}
              title={ilustrativa ? 'Somente ilustrativo' : undefined}
            >
              {categoria.rotulo}
              {ilustrativa && <span className="item-picker__tab-hint">ilustrativo</span>}
            </button>
          )
        })}
      </nav>

      <div className="item-picker__panel">
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
                    {selecionado && <span className="item-card__check" aria-hidden="true">✓</span>}
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
