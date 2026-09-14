import { useEffect, useId, useRef } from 'react'
import * as ui from './adminClasses'

export type SecaoAjuda =
  | 'visao-geral'
  | 'cadastro'
  | 'catalogo'
  | 'imagens'
  | 'montagens'
  | 'assinatura'

type Props = {
  aberto: boolean
  secaoInicial?: SecaoAjuda
  aoFechar: () => void
}

const EXEMPLO_SOUSPLAT = '/ajuda/exemplo-sousplat.webp'
const EXEMPLO_TACA = '/ajuda/exemplo-taca.webp'

export function AdminAjuda({ aberto, secaoInicial = 'visao-geral', aoFechar }: Props) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const fecharRef = useRef<HTMLButtonElement>(null)
  const secaoRefs = useRef<Partial<Record<SecaoAjuda, HTMLElement | null>>>({})

  useEffect(() => {
    if (!aberto) return

    const alvo = secaoRefs.current[secaoInicial]
    if (alvo) {
      requestAnimationFrame(() => {
        alvo.scrollIntoView({ block: 'start', behavior: 'auto' })
      })
    } else {
      fecharRef.current?.focus()
    }

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
  }, [aberto, aoFechar, secaoInicial])

  if (!aberto) return null

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
          <section
            ref={(el) => {
              secaoRefs.current['visao-geral'] = el
            }}
            className={ui.modalAjudaSecao}
            aria-labelledby="ajuda-visao-geral"
          >
            <h3 id="ajuda-visao-geral">Visão geral</h3>
            <p>
              No painel você monta o catálogo (categorias e itens). Os visitantes
              abrem a página pública do seu estabelecimento, montam a mesa e
              enviam o pedido. As montagens aparecem em Montagens enviadas para
              você acompanhar e responder.
            </p>
          </section>

          <section
            ref={(el) => {
              secaoRefs.current.cadastro = el
            }}
            className={ui.modalAjudaSecao}
            aria-labelledby="ajuda-cadastro"
          >
            <h3 id="ajuda-cadastro">Cadastro</h3>
            <p>
              Em Atualizar cadastro, configure o nome, a URL pública (slug), o
              logo e o WhatsApp. O WhatsApp é necessário para o visitante
              conseguir falar com você após enviar a montagem.
            </p>
          </section>

          <section
            ref={(el) => {
              secaoRefs.current.catalogo = el
            }}
            className={ui.modalAjudaSecao}
            aria-labelledby="ajuda-catalogo"
          >
            <h3 id="ajuda-catalogo">Categorias e itens</h3>
            <ul>
              <li>Crie categorias (ex.: Sousplat, Taças) e depois cadastre os itens.</li>
              <li>
                Em cada item informe nome, descrição, dimensões em cm e a foto.
              </li>
              <li>
                A categoria de toalhas é fixa do sistema: você pode visualizar,
                mas não editar ou excluir.
              </li>
            </ul>
          </section>

          <section
            ref={(el) => {
              secaoRefs.current.imagens = el
            }}
            className={ui.modalAjudaSecaoDestaque}
            aria-labelledby="ajuda-imagens"
          >
            <h3 id="ajuda-imagens">Imagens dos itens</h3>
            <p>
              A foto define como o item aparece na mesa. Prefira WebP ou PNG com
              fundo transparente (sem mesa ou cenário de fundo). O objeto deve
              ficar centralizado no quadro. Formatos aceitos: WebP, PNG, JPEG e
              GIF, até 5 MB — o sistema comprime automaticamente.
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
                  Vista de lado, base apoiada na parte de baixo do quadro, com
                  espaço transparente em volta.
                </figcaption>
              </figure>
            </div>
          </section>

          <section
            ref={(el) => {
              secaoRefs.current.montagens = el
            }}
            className={ui.modalAjudaSecao}
            aria-labelledby="ajuda-montagens"
          >
            <h3 id="ajuda-montagens">Página pública e montagens</h3>
            <p>
              Use Ver montagem para abrir a página que seus clientes veem. Em
              Montagens enviadas você encontra os pedidos, altera o status
              (novo, contatado, fechado, arquivado), anota observações e abre
              WhatsApp ou e-mail do visitante.
            </p>
          </section>

          <section
            ref={(el) => {
              secaoRefs.current.assinatura = el
            }}
            className={ui.modalAjudaSecao}
            aria-labelledby="ajuda-assinatura"
          >
            <h3 id="ajuda-assinatura">Assinatura</h3>
            <p>
              Durante o período de avaliação o painel fica liberado. Sem trial
              ou assinatura ativos, o acesso ao painel é bloqueado até
              regularizar em Assinatura.
            </p>
          </section>
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
