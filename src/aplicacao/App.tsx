import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { PreVisualizacaoMesa, SeletorItens } from '../funcionalidades/mesa'
import { criarConfiguracaoVazia, obterItemPorId } from '../funcionalidades/catalogo'
import { exportarMontagemPng } from '../funcionalidades/mesa/exportarMontagem'
import {
  lerMontagemDaUrl,
  mesmaMontagem,
  temSelecao,
  urlComMontagem,
} from '../funcionalidades/mesa/montagemUrl'
import { useAuth } from '../funcionalidades/autenticacao'
import { ImagemAmpliada } from '../compartilhado/ImagemAmpliada'
import type { ConfiguracaoMesa, DadosCliente, IdCategoria, ItemMesa } from '../compartilhado/tipos'
import './App.css'

interface PropsApp {
  dados: DadosCliente
}

function montagemDeDados(
  search: string,
  categorias: DadosCliente['categorias'],
  itens: DadosCliente['itens'],
): ConfiguracaoMesa {
  return lerMontagemDaUrl(search, categorias, itens) ?? criarConfiguracaoVazia(categorias)
}

export default function App({ dados }: PropsApp) {
  const { nome, logo, categorias, itens } = dados
  const { cliente, carregando } = useAuth()
  const mostrarAdmin = !carregando && !!cliente
  const localizacao = useLocation()
  const navegar = useNavigate()
  const { slug } = useParams<{ slug: string }>()

  const [configuracao, setConfiguracao] = useState<ConfiguracaoMesa>(() =>
    montagemDeDados(localizacao.search, categorias, itens),
  )
  const [categoriaAtiva, setCategoriaAtiva] = useState<IdCategoria>(
    () => categorias[0]?.id ?? '',
  )
  const [anuncio, setAnuncio] = useState('')
  const [pulsoPreview, setPulsoPreview] = useState(false)
  const [itemAmpliado, setItemAmpliado] = useState<ItemMesa | null>(null)
  const [previewExpandido, setPreviewExpandido] = useState(false)
  const [configAnterior, setConfigAnterior] = useState<ConfiguracaoMesa | null>(null)
  const [copiandoLink, setCopiandoLink] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [feedbackAcao, setFeedbackAcao] = useState<string | null>(null)

  const pulsoTimeoutRef = useRef<number | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const sheetFecharRef = useRef<HTMLButtonElement>(null)
  const expandirBtnRef = useRef<HTMLButtonElement>(null)

  const categoriasKey = categorias.map((c) => c.id).join(',')

  // Catálogo trocou (outro cliente / remount): realinha categoria e desfaz.
  useEffect(() => {
    setCategoriaAtiva((ativa) =>
      categorias.some((c) => c.id === ativa) ? ativa : (categorias[0]?.id ?? ''),
    )
    setConfigAnterior(null)
  }, [categoriasKey, categorias])

  // Aplica montagem da URL (back/forward / link compartilhado).
  useEffect(() => {
    const daUrl = montagemDeDados(localizacao.search, categorias, itens)
    setConfiguracao((anterior) => (mesmaMontagem(anterior, daUrl) ? anterior : daUrl))
  }, [localizacao.search, categorias, itens])

  // Mantém `?m=` alinhado com a seleção atual (replace).
  useEffect(() => {
    const caminho = urlComMontagem(localizacao.pathname, configuracao)
    const atual = `${localizacao.pathname}${localizacao.search}`
    if (caminho === atual) return
    if (caminho === localizacao.pathname && !localizacao.search) return
    navegar(caminho, { replace: true })
  }, [configuracao, localizacao.pathname, localizacao.search, navegar])
  useEffect(() => {
    if (!feedbackAcao) return
    const t = window.setTimeout(() => setFeedbackAcao(null), 3500)
    return () => window.clearTimeout(t)
  }, [feedbackAcao])

  useEffect(() => {
    return () => {
      if (pulsoTimeoutRef.current != null) {
        window.clearTimeout(pulsoTimeoutRef.current)
      }
    }
  }, [])

  // Sheet expandido: Escape, focus trap, trava scroll do body.
  useEffect(() => {
    if (!previewExpandido) return

    const trigger = expandirBtnRef.current
    sheetFecharRef.current?.focus()

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        setPreviewExpandido(false)
        return
      }
      if (evento.key !== 'Tab' || !sheetRef.current) return

      const focaveis = sheetRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]!
      const ultimo = focaveis[focaveis.length - 1]!
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    document.addEventListener('keydown', aoTecla)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', aoTecla)
      document.body.style.overflow = overflowAnterior
      trigger?.focus()
    }
  }, [previewExpandido])

  function selecionar(categoria: IdCategoria, idItem: string | null) {
    setConfigAnterior(null)
    setConfiguracao((anterior) => ({ ...anterior, [categoria]: idItem }))
    const cat = categorias.find((c) => c.id === categoria)
    const item = obterItemPorId(itens, idItem)
    if (item && cat) {
      setAnuncio(`${cat.rotulo}: ${item.nome}`)
      setPulsoPreview(true)
      if (pulsoTimeoutRef.current != null) {
        window.clearTimeout(pulsoTimeoutRef.current)
      }
      pulsoTimeoutRef.current = window.setTimeout(() => {
        setPulsoPreview(false)
        pulsoTimeoutRef.current = null
      }, 450)
    } else if (cat) {
      setAnuncio(`${cat.rotulo}: seleção removida`)
    }
  }

  function limparTudo() {
    if (!temSelecao(configuracao)) return
    setConfigAnterior(configuracao)
    setConfiguracao(criarConfiguracaoVazia(categorias))
    setAnuncio('Montagem limpa')
  }

  function desfazerLimpar() {
    if (!configAnterior) return
    setConfiguracao(configAnterior)
    setConfigAnterior(null)
    setAnuncio('Montagem restaurada')
  }

  function focarPicker() {
    const primeira = categorias[0]
    if (primeira) setCategoriaAtiva(primeira.id)
    document.getElementById('selecao-itens')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function copiarParaClipboard(texto: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(texto)
      return true
    } catch {
      try {
        const area = document.createElement('textarea')
        area.value = texto
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.left = '-9999px'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        return ok
      } catch {
        return false
      }
    }
  }

  async function copiarLink() {
    const caminho = urlComMontagem(localizacao.pathname, configuracao)
    const absoluto = `${window.location.origin}${caminho}`
    setCopiandoLink(true)
    try {
      const ok = await copiarParaClipboard(absoluto)
      navegar(caminho, { replace: true })
      if (ok) {
        setFeedbackAcao('Link da montagem copiado.')
        setAnuncio('Link da montagem copiado')
      } else {
        setFeedbackAcao('Não foi possível copiar o link. Copie da barra de endereço.')
      }
    } finally {
      setCopiandoLink(false)
    }
  }

  async function baixarImagem() {
    if (!temSelecao(configuracao)) return
    setExportando(true)
    try {
      const data = new Date()
      const yyyy = data.getFullYear()
      const mm = String(data.getMonth() + 1).padStart(2, '0')
      const dd = String(data.getDate()).padStart(2, '0')
      const hh = String(data.getHours()).padStart(2, '0')
      const min = String(data.getMinutes()).padStart(2, '0')
      const ss = String(data.getSeconds()).padStart(2, '0')
      const slugArquivo = (slug ?? 'montagem').replace(/[^a-zA-Z0-9-_]/g, '-')
      const nomeArquivo = `${slugArquivo}-${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.png`
      const aviso = await exportarMontagemPng(
        configuracao,
        categorias,
        itens,
        nomeArquivo,
      )
      setFeedbackAcao(aviso ?? 'Imagem baixada.')
      setAnuncio('Imagem da montagem baixada')
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : 'Não foi possível baixar a imagem.'
      setFeedbackAcao(msg)
    } finally {
      setExportando(false)
    }
  }

  const resumoSelecionado = categorias
    .map((categoria) => {
      const item = obterItemPorId(itens, configuracao[categoria.id] ?? null)
      return item ? { categoria: categoria.rotulo, item: item.nome } : null
    })
    .filter(Boolean) as { categoria: string; item: string }[]

  const haSelecao = resumoSelecionado.length > 0
  const ultimoItem = resumoSelecionado[resumoSelecionado.length - 1]

  return (
    <div className="app">
      <a className="app__skip" href="#conteudo-principal">
        Ir para o conteúdo
      </a>

      <header className="app__header">
        <div className="app__brand">
          {logo && <img className="app__logo" src={logo} alt={`Logo ${nome}`} />}
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

      {feedbackAcao && (
        <div className="app__toast" role="status">
          {feedbackAcao}
        </div>
      )}

      <main id="conteudo-principal" className="app__main">
        <section
          className={`app__preview ${pulsoPreview ? 'is-pulse' : ''} ${previewExpandido ? 'is-expanded' : ''}`}
          aria-label="Pré-visualização da mesa"
        >
          {haSelecao && (
            <div className="setting-summary--compact" aria-live="polite">
              <p className="setting-summary--compact__count">
                {resumoSelecionado.length}{' '}
                {resumoSelecionado.length === 1 ? 'item' : 'itens'}
                {ultimoItem ? ` · ${ultimoItem.item}` : ''}
              </p>
              <ul className="setting-summary--compact__chips" aria-label="Itens selecionados">
                {resumoSelecionado.map(({ categoria, item }) => (
                  <li key={categoria}>
                    <span className="setting-summary__cat">{categoria}</span>
                    <span className="setting-summary__item">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="app__preview-toolbar">
            <button
              ref={expandirBtnRef}
              type="button"
              className="btn btn--ghost app__preview-expand"
              onClick={() => setPreviewExpandido((v) => !v)}
              aria-expanded={previewExpandido}
            >
              {previewExpandido ? 'Recolher preview' : 'Expandir preview'}
            </button>
          </div>

          <PreVisualizacaoMesa
            configuracao={configuracao}
            categorias={categorias}
            itens={itens}
            aoComecarVazio={focarPicker}
            aoAmpliarItem={setItemAmpliado}
          />
          {haSelecao && (
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

        {previewExpandido && (
          <div
            ref={sheetRef}
            className="app__preview-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Pré-visualização ampliada"
          >
            <div className="app__preview-sheet__barra">
              <p>Pré-visualização</p>
              <button
                ref={sheetFecharRef}
                type="button"
                className="btn btn--ghost"
                onClick={() => setPreviewExpandido(false)}
              >
                Fechar
              </button>
            </div>
            <PreVisualizacaoMesa
              configuracao={configuracao}
              categorias={categorias}
              itens={itens}
              aoAmpliarItem={setItemAmpliado}
            />
          </div>
        )}

        {itemAmpliado?.imagem && (
          <ImagemAmpliada
            src={itemAmpliado.imagem}
            alt={itemAmpliado.nome}
            aberto
            aoFechar={() => setItemAmpliado(null)}
          />
        )}

        <section
          id="selecao-itens"
          className="app__picker"
          aria-label="Seleção de itens"
        >
          <div className="app__picker-toolbar">
            {configAnterior && (
              <button type="button" className="btn btn--ghost" onClick={desfazerLimpar}>
                Desfazer limpar
              </button>
            )}
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void copiarLink()}
              disabled={!haSelecao || copiandoLink}
            >
              {copiandoLink ? 'Copiando…' : 'Copiar link'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => void baixarImagem()}
              disabled={!haSelecao || exportando}
            >
              {exportando ? 'Gerando…' : 'Baixar imagem'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={limparTudo}
              disabled={!haSelecao}
            >
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
