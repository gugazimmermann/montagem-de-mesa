import { useEffect, useId, useRef, useState } from 'react'
import * as ui from './adminClasses'

export type SecaoAjuda =
  | 'visao-geral'
  | 'cadastro'
  | 'catalogo'
  | 'imagens'
  | 'layout-mesa'
  | 'talheres'
  | 'guardanapo-tacas'
  | 'montagens'
  | 'assinatura'

type Props = {
  aberto: boolean
  secaoInicial?: SecaoAjuda
  aoFechar: () => void
}

const EXEMPLO_SOUSPLAT = '/ajuda/exemplo-sousplat.webp'
const EXEMPLO_TACA = '/ajuda/exemplo-taca.webp'

const PAGINAS: { id: SecaoAjuda; titulo: string }[] = [
  { id: 'visao-geral', titulo: 'Visão geral' },
  { id: 'cadastro', titulo: 'Cadastro' },
  { id: 'catalogo', titulo: 'Categorias e itens' },
  { id: 'imagens', titulo: 'Imagens' },
  { id: 'layout-mesa', titulo: 'Layout da mesa' },
  { id: 'talheres', titulo: 'Talheres' },
  { id: 'guardanapo-tacas', titulo: 'Guardanapo e taças' },
  { id: 'montagens', titulo: 'Página pública' },
  { id: 'assinatura', titulo: 'Assinatura' },
]

function PaginaVisaoGeral() {
  return (
    <section className={ui.modalAjudaSecao} aria-labelledby="ajuda-visao-geral">
      <h3 id="ajuda-visao-geral">Visão geral</h3>
      <p>
        No painel você monta o catálogo (categorias e itens). Os visitantes abrem
        a página pública do seu estabelecimento, escolhem as peças, veem a
        pré-visualização em tempo real e enviam a montagem.
      </p>
      <ul>
        <li>
          <strong>Catálogo</strong> — organize as categorias (sousplat, pratos,
          talheres, taças, etc.) e cadastre cada peça com foto e medidas.
        </li>
        <li>
          <strong>Página pública</strong> — o link <code>/:slug</code> é o que
          você compartilha com o cliente.
        </li>
        <li>
          <strong>Montagens enviadas</strong> — pedidos, status do lead e contato
          por WhatsApp ou e-mail.
        </li>
      </ul>
      <p>
        Use os tópicos ao lado para detalhes de imagens, layout de etiqueta e
        como nomear talheres para o sistema posicioná-los corretamente.
      </p>
    </section>
  )
}

function PaginaCadastro() {
  return (
    <section className={ui.modalAjudaSecao} aria-labelledby="ajuda-cadastro">
      <h3 id="ajuda-cadastro">Cadastro</h3>
      <p>
        Defina o nome de exibição (como o estabelecimento aparece no painel e na
        página pública). Em Atualizar cadastro, ajuste também a URL pública
        (slug), o logo e o WhatsApp.
      </p>
      <ul>
        <li>
          O <strong>WhatsApp</strong> é necessário para o visitante falar com
          você após enviar a montagem.
        </li>
        <li>
          A <strong>logo</strong> é otimizada automaticamente (até ~512px, WebP)
          para carregar rápido na página pública.
        </li>
        <li>
          O <strong>slug</strong> forma o endereço público (ex.:{' '}
          <code>/raffiner</code>).
        </li>
      </ul>
    </section>
  )
}

function PaginaCatalogo() {
  return (
    <section className={ui.modalAjudaSecao} aria-labelledby="ajuda-catalogo">
      <h3 id="ajuda-catalogo">Categorias e itens</h3>
      <p>
        Crie categorias e depois cadastre os itens. A ordem de empilhamento no
        preview segue o código da categoria (do fundo para o topo):
      </p>
      <ul>
        <li>Toalha (fixa do sistema — só visualização)</li>
        <li>Lugar americano</li>
        <li>Sousplat</li>
        <li>Prato raso → prato fundo → prato de sobremesa</li>
        <li>Guardanapo → porta-guardanapo</li>
        <li>Talheres → taças</li>
      </ul>
      <p>
        Em cada item informe nome, descrição, dimensões em cm e as fotos. As
        medidas em cm controlam o tamanho relativo na montagem.
      </p>
      <h4>Dicas</h4>
      <ul>
        <li>
          Use nomes claros nos talheres (ex.: “Garfo de Mesa”, “Colher de
          Sobremesa”) — o preview posiciona pela palavra-chave do nome.
        </li>
        <li>
          Você pode ter sousplat <em>ou</em> lugar americano, ou os dois; o
          layout se adapta.
        </li>
      </ul>
    </section>
  )
}

function PaginaImagens() {
  return (
    <section
      className={ui.modalAjudaSecaoDestaque}
      aria-labelledby="ajuda-imagens"
    >
      <h3 id="ajuda-imagens">Imagens dos itens</h3>
      <p>
        A foto define como o item aparece na mesa. Prefira WebP ou PNG com fundo
        transparente (sem mesa ou cenário de fundo). O objeto deve ficar
        centralizado no quadro. Formatos: WebP, PNG, JPEG e GIF, até 5 MB — o
        sistema comprime automaticamente.
      </p>
      <p>
        Se o item tiver duas fotos: a <strong>frontal / catálogo</strong> aparece
        na lista do seletor; a foto de <strong>ângulo de mesa</strong> entra no
        preview.
      </p>
      <p>
        As dimensões em cm (largura e comprimento) controlam o tamanho na
        montagem; a imagem só define o recorte visual.
      </p>

      <div className={ui.modalAjudaExemplos}>
        <figure className={ui.modalAjudaExemplo}>
          <p className={ui.modalAjudaExemploTitulo}>Peça plana (sousplat)</p>
          <div className={ui.modalAjudaExemploPreview}>
            <img
              src={EXEMPLO_SOUSPLAT}
              alt="Exemplo de sousplat com fundo transparente"
            />
          </div>
          <figcaption className={ui.modalAjudaExemploDesc}>
            Vista de cima, peça preenchendo o quadro, fundo transparente.
          </figcaption>
        </figure>

        <figure className={ui.modalAjudaExemplo}>
          <p className={ui.modalAjudaExemploTitulo}>Peça alta (taça)</p>
          <div className={ui.modalAjudaExemploPreview}>
            <img
              src={EXEMPLO_TACA}
              alt="Exemplo de taça com fundo transparente"
            />
          </div>
          <figcaption className={ui.modalAjudaExemploDesc}>
            Vista de lado, base apoiada na parte de baixo do quadro, com espaço
            transparente em volta.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

function PaginaLayoutMesa() {
  return (
    <section className={ui.modalAjudaSecao} aria-labelledby="ajuda-layout-mesa">
      <h3 id="ajuda-layout-mesa">Layout da mesa</h3>
      <p>
        O preview monta o lugar à mesa automaticamente, com espaçamentos de
        etiqueta formal. O visitante (e você, ao testar a página pública) escolhe
        as peças; o sistema posiciona cada uma.
      </p>
      <h4>Empilhamento (centro)</h4>
      <ul>
        <li>
          Base: lugar americano e/ou sousplat, depois pratos (do maior/mais baixo
          para o de sobremesa).
        </li>
        <li>Guardanapo no centro dos pratos; porta-guardanapo por cima, se houver.</li>
      </ul>
      <h4>Ao redor</h4>
      <ul>
        <li>
          <strong>Talheres</strong> e <strong>taças</strong> permitem{' '}
          <em>vários itens</em> ao mesmo tempo (não é escolha única).
        </li>
        <li>
          Garfos e colheres de mesa à <strong>esquerda</strong>; facas à{' '}
          <strong>direita</strong>; sobremesa <strong>acima</strong> do prato
          (horizontal).
        </li>
        <li>
          Taças no canto <strong>superior direito</strong>, em diagonal.
        </li>
      </ul>
      <h4>Sousplat × lugar americano</h4>
      <ul>
        <li>
          Com <strong>sousplat</strong>, o lugar fica compacto junto à borda
          inferior da mesa (espaço para as taças acima).
        </li>
        <li>
          Com <strong>lugar americano</strong>, o bloco é recentrado e elevado
          para o retângulo do jogo não sair da mesa.
        </li>
      </ul>
      <p>
        A montagem pode ser compartilhada por link (<code>?m=</code> na URL) e
        exportada em PNG.
      </p>
    </section>
  )
}

function PaginaTalheres() {
  return (
    <section className={ui.modalAjudaSecao} aria-labelledby="ajuda-talheres">
      <h3 id="ajuda-talheres">Talheres</h3>
      <p>
        Cadastre cada peça na categoria Talheres. O <strong>nome</strong> do
        item decide o lado na mesa — use palavras-chave claras:
      </p>
      <ul>
        <li>
          <code>Garfo</code> (sem “sobremesa”) → esquerda, perto do prato
        </li>
        <li>
          <code>Colher de Mesa</code> / colher (sem sobremesa) → esquerda, mais
          externa que o garfo
        </li>
        <li>
          <code>Faca</code> → direita, fio voltado para o prato
        </li>
        <li>
          <code>Colher de Sobremesa</code> / <code>Garfo de Sobremesa</code> →
          acima do prato, cabo à direita
        </li>
      </ul>
      <h4>Vários do mesmo tipo</h4>
      <p>
        O visitante pode marcar mais de um garfo ou mais de uma faca. Peças de
        entrada/salada/sobremesa (pelo nome) ficam mais externas; as de mesa,
        mais perto do prato.
      </p>
      <h4>Exemplos de nomes bons</h4>
      <ul>
        <li>Garfo de Mesa Agra Capuccino</li>
        <li>Faca de Mesa Bambu</li>
        <li>Colher de Mesa Agra Vermelho</li>
        <li>Colher de Sobremesa Agra Capuccino</li>
        <li>Garfo de Entrada Prata</li>
      </ul>
      <p>
        Evite nomes genéricos como só “Talher 1” — o sistema não saberá onde
        colocar a peça.
      </p>
    </section>
  )
}

function PaginaGuardanapoTacas() {
  return (
    <section
      className={ui.modalAjudaSecao}
      aria-labelledby="ajuda-guardanapo-tacas"
    >
      <h3 id="ajuda-guardanapo-tacas">Guardanapo e taças</h3>
      <h4>Guardanapo</h4>
      <p>
        Use foto do guardanapo já dobrado (vista de cima), com fundo
        transparente. Muitos catálogos incluem um <strong>anel de madeira</strong>{' '}
        na própria imagem — isso é esperado.
      </p>
      <h4>Porta-guardanapo</h4>
      <p>
        Quando o visitante escolhe um porta-guardanapo, ele é desenhado{' '}
        <strong>sobre o anel de madeira</strong> da foto do guardanapo, cobrindo-o.
        Sem guardanapo selecionado, o porta não aparece na mesa.
      </p>
      <h4>Taças</h4>
      <ul>
        <li>Também é multi-seleção (água + vinho, por exemplo).</li>
        <li>
          A taça mais baixa (menor altura em cm) fica mais perto do prato; a mais
          alta, mais afastada na diagonal.
        </li>
        <li>
          Prefira foto de perfil com a base na parte de baixo do quadro (veja
          o exemplo em Imagens).
        </li>
      </ul>
    </section>
  )
}

function PaginaMontagens() {
  return (
    <section className={ui.modalAjudaSecao} aria-labelledby="ajuda-montagens">
      <h3 id="ajuda-montagens">Página pública e montagens</h3>
      <p>
        Use Página pública para abrir o que seus clientes veem. Teste a montagem
        como visitante: selecione várias peças e confira se talheres e taças
        aparecem nos lugares certos.
      </p>
      <ul>
        <li>
          Em <strong>Montagens enviadas</strong> você acompanha pedidos, altera
          o status (novo, contatado, fechado, arquivado) e anota observações.
        </li>
        <li>Abra WhatsApp ou e-mail do visitante a partir do histórico.</li>
        <li>
          O link da montagem guarda a seleção (<code>?m=</code>) para reabrir o
          mesmo conjunto de peças.
        </li>
      </ul>
    </section>
  )
}

function PaginaAssinatura() {
  return (
    <section className={ui.modalAjudaSecao} aria-labelledby="ajuda-assinatura">
      <h3 id="ajuda-assinatura">Assinatura</h3>
      <p>
        Durante o período de avaliação o painel e a página pública ficam
        liberados. Sem trial ou assinatura ativos, o acesso é bloqueado até
        regularizar em Assinatura.
      </p>
      <ul>
        <li>Assinar abre o Checkout Stripe.</li>
        <li>
          Com assinatura ativa, Gerenciar cobrança abre o portal (cartão, faturas,
          cancelamento).
        </li>
      </ul>
    </section>
  )
}

function ConteudoPagina({ id }: { id: SecaoAjuda }) {
  switch (id) {
    case 'visao-geral':
      return <PaginaVisaoGeral />
    case 'cadastro':
      return <PaginaCadastro />
    case 'catalogo':
      return <PaginaCatalogo />
    case 'imagens':
      return <PaginaImagens />
    case 'layout-mesa':
      return <PaginaLayoutMesa />
    case 'talheres':
      return <PaginaTalheres />
    case 'guardanapo-tacas':
      return <PaginaGuardanapoTacas />
    case 'montagens':
      return <PaginaMontagens />
    case 'assinatura':
      return <PaginaAssinatura />
  }
}

export function AdminAjuda({
  aberto,
  secaoInicial = 'visao-geral',
  aoFechar,
}: Props) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)
  const [paginaAtiva, setPaginaAtiva] = useState<SecaoAjuda>(secaoInicial)

  useEffect(() => {
    if (!aberto) return
    setPaginaAtiva(secaoInicial)
  }, [aberto, secaoInicial])

  useEffect(() => {
    if (!aberto) return
    painelRef.current?.scrollTo({ top: 0 })
  }, [aberto, paginaAtiva])

  useEffect(() => {
    if (!aberto) return

    fecharRef.current?.focus()

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        aoFechar()
        return
      }
      if (evento.key !== 'Tab' || !dialogRef.current) return

      const focaveis = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focaveis.length === 0) return
      const primeiro = focaveis[0]
      const ultimo = focaveis[focaveis.length - 1]
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault()
        ultimo.focus()
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault()
        primeiro.focus()
      }
    }

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', aoTecla)
    }
  }, [aberto, aoFechar])

  if (!aberto) return null

  const tituloAtivo =
    PAGINAS.find((p) => p.id === paginaAtiva)?.titulo ?? 'Ajuda'

  return (
    <div
      className={ui.modalBackdrop}
      role="presentation"
      onClick={aoFechar}
    >
      <div
        ref={dialogRef}
        className={ui.modalAjuda}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={ui.modalAjudaCabecalho}>
          <h2 id={tituloId}>Como usar o sistema</h2>
          <button
            ref={fecharRef}
            type="button"
            className="btn btn--ghost"
            onClick={aoFechar}
            aria-label="Fechar ajuda"
          >
            Fechar
          </button>
        </div>

        <div className={ui.modalAjudaCorpo}>
          <nav
            className={ui.modalAjudaNav}
            aria-label="Tópicos da ajuda"
          >
            {PAGINAS.map((pagina) => {
              const ativa = pagina.id === paginaAtiva
              return (
                <button
                  key={pagina.id}
                  type="button"
                  className={`${ui.modalAjudaNavItem} ${ativa ? ui.modalAjudaNavItemAtivo : ''}`}
                  aria-current={ativa ? 'page' : undefined}
                  onClick={() => setPaginaAtiva(pagina.id)}
                >
                  {pagina.titulo}
                </button>
              )
            })}
          </nav>

          <div
            ref={painelRef}
            className={ui.modalAjudaPainel}
            aria-label={tituloAtivo}
          >
            <ConteudoPagina id={paginaAtiva} />
          </div>
        </div>

        <div className={ui.modalAjudaRodape}>
          <button type="button" className="btn btn--primary" onClick={aoFechar}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
