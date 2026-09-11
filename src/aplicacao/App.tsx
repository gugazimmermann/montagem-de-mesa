import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PreVisualizacaoMesa, SeletorItens } from '../funcionalidades/mesa'
import { criarConfiguracaoVazia, obterItemPorId } from '../funcionalidades/catalogo'
import { useAuth } from '../funcionalidades/autenticacao'
import { ImagemAmpliada } from '../compartilhado/ImagemAmpliada'
import type { ConfiguracaoMesa, DadosCliente, IdCategoria, ItemMesa } from '../compartilhado/tipos'
import { ID_CATEGORIA_TOALHA } from '../dados/categoriasFixas'
import './App.css'

interface PropsApp {
  dados: DadosCliente
}

export default function App({ dados }: PropsApp) {
  const { nome, logo, categorias, itens } = dados
  const { cliente, carregando } = useAuth()
  const mostrarAdmin = !carregando && !!cliente

  const configuracaoInicial = useMemo(
    () => criarConfiguracaoVazia(categorias),
    [categorias],
  )

  const [configuracao, setConfiguracao] = useState<ConfiguracaoMesa>(configuracaoInicial)
  const [categoriaAtiva, setCategoriaAtiva] = useState<IdCategoria>(
    () => categorias[0]?.id ?? '',
  )
  const [anuncio, setAnuncio] = useState('')
  const [pulsoPreview, setPulsoPreview] = useState(false)
  const [itemAmpliado, setItemAmpliado] = useState<ItemMesa | null>(null)

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
    const cat = categorias.find((c) => c.id === categoria)
    const item = obterItemPorId(itens, idItem)
    if (item && cat) {
      setAnuncio(`${cat.rotulo}: ${item.nome}`)
      setPulsoPreview(true)
      window.setTimeout(() => setPulsoPreview(false), 450)
    } else if (cat) {
      setAnuncio(`${cat.rotulo}: seleção removida`)
    }
  }

  function limparTudo() {
    setConfiguracao(criarConfiguracaoVazia(categorias))
    setAnuncio('Montagem limpa')
  }

  function comecarPelaPrimeira() {
    const primeira = categorias[0]
    if (primeira) setCategoriaAtiva(primeira.id)
  }

  const resumoSelecionado = categorias
    .filter((categoria) => categoria.id !== ID_CATEGORIA_TOALHA)
    .map((categoria) => {
      const item = obterItemPorId(itens, configuracao[categoria.id] ?? null)
      return item ? { categoria: categoria.rotulo, item: item.nome } : null
    })
    .filter(Boolean) as { categoria: string; item: string }[]

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          {logo && <img className="app__logo" src={logo} alt="" />}
          <p className="app__product">Montagem de Mesa</p>
          <h1>{nome}</h1>
          <p className="app__subtitle">Escolha as peças — a mesa atualiza na hora.</p>
        </div>
        {mostrarAdmin && (
          <Link className="btn btn--ghost" to="/admin/painel">
            Painel admin
          </Link>
        )}
      </header>

      <p className="app__live" aria-live="polite" aria-atomic="true">
        {anuncio}
      </p>

      <main className="app__main">
        <section
          className={`app__preview ${pulsoPreview ? 'is-pulse' : ''}`}
          aria-label="Pré-visualização da mesa"
        >
          {resumoSelecionado.length > 0 && (
            <p className="setting-summary--compact">
              {resumoSelecionado.length}{' '}
              {resumoSelecionado.length === 1 ? 'item selecionado' : 'itens selecionados'}
            </p>
          )}
          <PreVisualizacaoMesa
            configuracao={configuracao}
            categorias={categorias}
            itens={itens}
            aoComecarVazio={comecarPelaPrimeira}
            aoAmpliarItem={setItemAmpliado}
          />
          {resumoSelecionado.length > 0 && (
            <ul className="setting-summary" aria-label="Itens selecionados">
              {resumoSelecionado.map(({ categoria, item }) => (
                <li key={categoria}>
                  <span className="setting-summary__cat">{categoria}</span>
                  <span className="setting-summary__item">{item}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {itemAmpliado?.imagem && (
          <ImagemAmpliada
            src={itemAmpliado.imagem}
            alt={itemAmpliado.nome}
            aberto
            aoFechar={() => setItemAmpliado(null)}
          />
        )}

        <section className="app__picker" aria-label="Seleção de itens">
          <div className="app__picker-toolbar">
            <button type="button" className="btn btn--ghost" onClick={limparTudo}>
              Limpar tudo
            </button>
          </div>
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
