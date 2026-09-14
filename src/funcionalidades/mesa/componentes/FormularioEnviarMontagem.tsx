import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import {
  formatarWhatsapp,
  normalizarWhatsapp,
} from '../../../dados/repositorioClientes'
import {
  enviarMontagemParaAdmin,
  type DadosVisitanteMontagem,
  type ItemMontagemEnviado,
} from '../../../dados/enviarMontagem'
import { rastrear } from '../../../compartilhado/observabilidade'
import { montarTextoMontagem, urlWhatsAppMontagem } from '../mensagemMontagem'
import './FormularioEnviarMontagem.css'

const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

type Props = {
  aberto: boolean
  slug: string
  whatsappAdmin: string
  nomeEstabelecimento: string
  itens: ItemMontagemEnviado[]
  linkMontagem: string
  aoFechar: () => void
  aoSucesso: (mensagem: string) => void
}

const vazio: DadosVisitanteMontagem = {
  nome: '',
  email: '',
  whatsapp: '',
  endereco: '',
  cidade: '',
  estado: '',
}

export function FormularioEnviarMontagem({
  aberto,
  slug,
  whatsappAdmin,
  nomeEstabelecimento,
  itens,
  linkMontagem,
  aoFechar,
  aoSucesso,
}: Props) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const primeiroCampoRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<DadosVisitanteMontagem>(vazio)
  const [whatsappExibicao, setWhatsappExibicao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [lgpdAceito, setLgpdAceito] = useState(false)

  const adminDigitos = whatsappAdmin.replace(/\D/g, '')
  const temWhatsappAdmin = adminDigitos.length >= 12

  useEffect(() => {
    if (!aberto) return
    setForm(vazio)
    setWhatsappExibicao('')
    setErro(null)
    setEnviando(false)
    setLgpdAceito(false)
    rastrear('send_opened', { slug })
    window.setTimeout(() => primeiroCampoRef.current?.focus(), 0)
  }, [aberto, slug])

  useEffect(() => {
    if (!aberto) return

    function aoTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !enviando) {
        aoFechar()
        return
      }
      if (evento.key !== 'Tab' || !dialogRef.current) return

      const focaveis = dialogRef.current.querySelectorAll<HTMLElement>(
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

    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', aoTecla)
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', aoTecla)
    }
  }, [aberto, aoFechar, enviando])

  if (!aberto) return null

  function atualizar<K extends keyof DadosVisitanteMontagem>(
    campo: K,
    valor: DadosVisitanteMontagem[K],
  ) {
    setForm((anterior) => ({ ...anterior, [campo]: valor }))
  }

  async function concluirEnvio() {
    setErro(null)

    const visitante: DadosVisitanteMontagem = {
      nome: form.nome.trim(),
      email: form.email.trim().toLowerCase(),
      whatsapp: normalizarWhatsapp(whatsappExibicao),
      endereco: form.endereco.trim(),
      cidade: form.cidade.trim(),
      estado: form.estado.trim().toUpperCase(),
    }

    if (
      !visitante.nome ||
      !visitante.email ||
      !visitante.whatsapp ||
      !visitante.endereco ||
      !visitante.cidade ||
      !visitante.estado
    ) {
      setErro('Preencha todos os campos.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitante.email)) {
      setErro('Informe um e-mail válido.')
      return
    }

    if (visitante.whatsapp.length < 12) {
      setErro('Informe um WhatsApp válido com DDD.')
      return
    }

    if (!lgpdAceito) {
      setErro('Confirme o uso dos seus dados para contato sobre esta montagem.')
      return
    }

    if (itens.length === 0) {
      setErro('Selecione ao menos um item na montagem.')
      return
    }

    setEnviando(true)
    try {
      await enviarMontagemParaAdmin({
        slug,
        visitante,
        itens,
        linkMontagem,
      })
      rastrear('send_ok', { slug, abrirWhatsApp: temWhatsappAdmin })

      if (temWhatsappAdmin) {
        const texto = montarTextoMontagem({
          visitante: {
            ...visitante,
            whatsapp: formatarWhatsapp(visitante.whatsapp) || visitante.whatsapp,
          },
          itens,
          linkMontagem,
          nomeEstabelecimento,
        })
        const janela = window.open(
          urlWhatsAppMontagem(adminDigitos, texto),
          '_blank',
          'noopener,noreferrer',
        )
        if (!janela) {
          rastrear('wa_blocked', { slug })
          aoSucesso(
            'Montagem registrada. Permita pop-ups para abrir o WhatsApp.',
          )
        } else {
          rastrear('wa_opened', { slug })
          aoSucesso(
            'WhatsApp aberto. Toque em Enviar na conversa para concluir.',
          )
        }
      } else {
        aoSucesso('Montagem enviada ao estabelecimento.')
      }
      aoFechar()
    } catch (e) {
      rastrear('send_fail', {
        slug,
        motivo: e instanceof Error ? e.message : 'unknown',
      })
      setErro(
        e instanceof Error && e.message
          ? e.message
          : 'Não foi possível enviar a montagem. Tente novamente.',
      )
    } finally {
      setEnviando(false)
    }
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    await concluirEnvio()
  }

  return (
    <div
      className="enviar-montagem-backdrop"
      role="presentation"
      onClick={enviando ? undefined : aoFechar}
    >
      <div
        ref={dialogRef}
        className="enviar-montagem"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-busy={enviando}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={tituloId}>Enviar montagem</h2>
        <p className="enviar-montagem__intro">
          {temWhatsappAdmin
            ? 'Preencha seus dados. Em seguida abrimos o WhatsApp com a montagem pronta — é só tocar em Enviar.'
            : 'Preencha seus dados. A montagem será enviada ao estabelecimento.'}
        </p>

        <form className="enviar-montagem__form" onSubmit={(e) => void aoEnviar(e)}>
          <label className="enviar-montagem__campo">
            <span>Nome</span>
            <input
              ref={primeiroCampoRef}
              name="nome"
              autoComplete="name"
              value={form.nome}
              onChange={(e) => atualizar('nome', e.target.value)}
              disabled={enviando}
              required
              maxLength={120}
            />
          </label>

          <label className="enviar-montagem__campo">
            <span>E-mail</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(e) => atualizar('email', e.target.value)}
              disabled={enviando}
              required
              maxLength={200}
            />
          </label>

          <label className="enviar-montagem__campo">
            <span>Seu WhatsApp</span>
            <input
              name="whatsapp"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(11) 99999-9999"
              value={whatsappExibicao}
              onChange={(e) => setWhatsappExibicao(formatarWhatsapp(e.target.value))}
              disabled={enviando}
              required
            />
          </label>

          <label className="enviar-montagem__campo">
            <span>Endereço</span>
            <input
              name="endereco"
              autoComplete="street-address"
              value={form.endereco}
              onChange={(e) => atualizar('endereco', e.target.value)}
              disabled={enviando}
              required
              maxLength={200}
            />
          </label>

          <div className="enviar-montagem__linha">
            <label className="enviar-montagem__campo">
              <span>Cidade</span>
              <input
                name="cidade"
                autoComplete="address-level2"
                value={form.cidade}
                onChange={(e) => atualizar('cidade', e.target.value)}
                disabled={enviando}
                required
                maxLength={100}
              />
            </label>

            <label className="enviar-montagem__campo enviar-montagem__campo--uf">
              <span>Estado</span>
              <select
                name="estado"
                autoComplete="address-level1"
                value={form.estado}
                onChange={(e) => atualizar('estado', e.target.value)}
                disabled={enviando}
                required
              >
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="enviar-montagem__check">
            <input
              type="checkbox"
              checked={lgpdAceito}
              onChange={(e) => setLgpdAceito(e.target.checked)}
              disabled={enviando}
              required
            />
            <span>
              Autorizo o uso dos meus dados de contato apenas para que o
              estabelecimento responda sobre esta montagem.
            </span>
          </label>

          {erro && (
            <p className="enviar-montagem__erro" role="alert">
              {erro}
            </p>
          )}

          <div className="enviar-montagem__acoes">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={enviando}
              onClick={aoFechar}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando
                ? temWhatsappAdmin
                  ? 'Abrindo WhatsApp…'
                  : 'Enviando…'
                : temWhatsappAdmin
                  ? 'Enviar pelo WhatsApp'
                  : 'Enviar montagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
