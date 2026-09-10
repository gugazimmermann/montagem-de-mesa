import { useMemo, useState } from 'react'
import { PreVisualizacaoMesa, SeletorItens } from '../funcionalidades/mesa'
import { criarConfiguracaoVazia, obterItemPorId } from '../funcionalidades/catalogo'
import type { ConfiguracaoMesa, DadosCliente, IdCategoria } from '../compartilhado/tipos'
import './App.css'

interface PropsApp {
  dados: DadosCliente
}

export default function App({ dados }: PropsApp) {
  const { nome, logo, categorias, itens } = dados

  const configuracaoInicial = useMemo(
    () => criarConfiguracaoVazia(categorias),
    [categorias],
  )

  const [configuracao, setConfiguracao] = useState<ConfiguracaoMesa>(configuracaoInicial)
  const [categoriaAtiva, setCategoriaAtiva] = useState<IdCategoria>(
    () => categorias[0]?.id ?? '',
  )

  // Se as categorias mudarem (outro cliente / remount), realinha estado
  const categoriasKey = categorias.map((c) => c.id).join(',')
  const [chaveAnterior, setChaveAnterior] = useState(categoriasKey)
  if (chaveAnterior !== categoriasKey) {
    setChaveAnterior(categoriasKey)
    setConfiguracao(criarConfiguracaoVazia(categorias))
    setCategoriaAtiva(categorias[0]?.id ?? '')
  }

  function selecionar(categoria: IdCategoria, idItem: string | null) {
    setConfiguracao((anterior) => ({ ...anterior, [categoria]: idItem }))
  }

  function limparTudo() {
    setConfiguracao(criarConfiguracaoVazia(categorias))
  }

  const resumoSelecionado = categorias
    .map((categoria) => {
      const item = obterItemPorId(itens, configuracao[categoria.id] ?? null)
      return item ? { categoria: categoria.rotulo, item: item.nome } : null
    })
    .filter(Boolean) as { categoria: string; item: string }[]

  return (
    <div className="app">
      <header className="app__header">
        <div>
          {logo && <img className="app__logo" src={logo} alt={nome} />}
          <h1>Montagem de Mesa</h1>
          <p className="app__subtitle">
            Monte seu lugar à mesa escolhendo sousplats, pratos, porta-guardanapos e
            taças. A mesa é atualizada conforme você seleciona cada peça.
          </p>
        </div>
        <div className="app__actions">
          <button type="button" className="btn btn--ghost" onClick={limparTudo}>
            Limpar tudo
          </button>
        </div>
      </header>

      <main className="app__main">
        <section className="app__preview" aria-label="Pré-visualização da mesa">
          <PreVisualizacaoMesa configuracao={configuracao} itens={itens} />
          {resumoSelecionado.length > 0 && (
            <ul className="setting-summary">
              {resumoSelecionado.map(({ categoria, item }) => (
                <li key={categoria}>
                  <span className="setting-summary__cat">{categoria}</span>
                  <span className="setting-summary__item">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="app__picker" aria-label="Seleção de itens">
          {categorias.length === 0 ? (
            <p className="app__sem-categorias">Este cliente ainda não possui categorias.</p>
          ) : (
            <SeletorItens
              categorias={categorias}
              itens={itens}
              categoriaAtiva={categoriaAtiva}
              configuracao={configuracao}
              aoMudarCategoria={setCategoriaAtiva}
              aoSelecionar={selecionar}
            />
          )}
        </section>
      </main>
    </div>
  )
}
