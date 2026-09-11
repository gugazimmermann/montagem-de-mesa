import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  atualizarCadastro,
  CadastroErro,
  enderecoMontagemEmUso,
  gerarSlug,
  obterSessaoCliente,
  solicitarTrocaEmail,
} from '../../dados/repositorioClientes'
import { enviarLogoStorage } from '../../dados/storage'
import { supabase } from '../../dados/supabase'
import { useAuth } from '../autenticacao'
import './PainelAdmin.css'
import './LoginAdmin.css'
import './EditarCategoria.css'

function limparHashUrl() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export function AtualizarCadastroAdmin() {
  const { cliente, definirCliente } = useAuth()
  const clienteAtual = cliente!

  const [nome, setNome] = useState(clienteAtual.nome)
  const [slug, setSlug] = useState(clienteAtual.slug)
  const [email, setEmail] = useState(clienteAtual.email)
  const [logo, setLogo] = useState(clienteAtual.logo)
  const [arquivoLogo, setArquivoLogo] = useState<File | null>(null)
  const [previewLogo, setPreviewLogo] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [avisoEmail, setAvisoEmail] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setNome(clienteAtual.nome)
    setSlug(clienteAtual.slug)
    setEmail(clienteAtual.email)
    setLogo(clienteAtual.logo)
  }, [clienteAtual.nome, clienteAtual.slug, clienteAtual.email, clienteAtual.logo])

  useEffect(() => {
    const bruto = window.location.hash.replace(/^#/, '')
    if (!bruto) return

    const params = new URLSearchParams(bruto)
    const message = (params.get('message') ?? '').toLowerCase()

    if (
      message.includes('other email') ||
      message.includes('confirmation link accepted')
    ) {
      setAvisoEmail(
        'Um dos links foi confirmado. Confirme também o segundo link (enviado ao outro e-mail) para a troca ser concluída. Com Gmail +alias, os dois links chegam na mesma caixa — abra os dois e-mails e clique nos dois links.',
      )
      setMensagem(null)
      setErro(null)
      limparHashUrl()
      return
    }

    const temTokenAuth =
      params.has('access_token') || params.get('type') === 'email_change'
    if (!temTokenAuth) return

    let cancelado = false

    void (async () => {
      // Não limpar o hash ainda: o client Supabase precisa dele para aplicar a sessão.
      for (let tentativa = 0; tentativa < 12 && !cancelado; tentativa += 1) {
        await new Promise((r) => setTimeout(r, 250))
        if (cancelado) return

        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) continue

        try {
          const sessao = await obterSessaoCliente()
          if (cancelado || !sessao) continue

          definirCliente(sessao)
          setEmail(sessao.email)
          setNome(sessao.nome)
          setSlug(sessao.slug)
          setLogo(sessao.logo)
          setAvisoEmail(null)
          setErro(null)
          setMensagem('Cadastro atualizado.')
          limparHashUrl()
          return
        } catch {
          // tenta de novo
        }
      }

      if (!cancelado) limparHashUrl()
    })()

    return () => {
      cancelado = true
    }
  }, [definirCliente])

  useEffect(() => {
    return () => {
      if (previewLogo) URL.revokeObjectURL(previewLogo)
    }
  }, [previewLogo])

  const logoExibida = previewLogo || logo

  function aoEscolherLogo(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return

    if (previewLogo) URL.revokeObjectURL(previewLogo)
    setArquivoLogo(arquivo)
    setPreviewLogo(URL.createObjectURL(arquivo))
    setMensagem(null)
    setErro(null)
  }

  async function aoVerificarEndereco() {
    const normalizado = gerarSlug(slug)
    setSlug(normalizado)

    if (!normalizado || normalizado === clienteAtual.slug) {
      setErro((atual) =>
        atual === 'Este endereço da montagem já está em uso.' ? null : atual,
      )
      return
    }

    try {
      const emUso = await enderecoMontagemEmUso(normalizado, clienteAtual.id)
      if (emUso) {
        setErro('Este endereço da montagem já está em uso.')
        setMensagem(null)
      } else {
        setErro((atual) =>
          atual === 'Este endereço da montagem já está em uso.' ? null : atual,
        )
      }
    } catch {
      // Falha silenciosa no blur; o save reforça a checagem.
    }
  }

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setMensagem(null)
    setAvisoEmail(null)

    const nomeTrim = nome.trim()
    const slugNormalizado = gerarSlug(slug)
    const emailTrim = email.trim().toLowerCase()

    if (!nomeTrim) {
      setErro('Informe o nome do cliente.')
      return
    }
    if (!slugNormalizado) {
      setErro('Informe o endereço da montagem.')
      return
    }
    if (!emailTrim) {
      setErro('Informe o e-mail.')
      return
    }

    setSlug(slugNormalizado)

    setSalvando(true)
    try {
      let logoFinal = logo.trim() || clienteAtual.logo
      if (arquivoLogo) {
        logoFinal = await enviarLogoStorage(clienteAtual.id, arquivoLogo)
      }

      const atualizado = await atualizarCadastro(clienteAtual.id, {
        nome: nomeTrim,
        slug: slugNormalizado,
        logo: logoFinal,
      })

      definirCliente(atualizado)
      setLogo(logoFinal)
      setSlug(atualizado.slug)
      if (previewLogo) {
        URL.revokeObjectURL(previewLogo)
        setPreviewLogo(null)
      }
      setArquivoLogo(null)

      if (emailTrim !== clienteAtual.email) {
        await solicitarTrocaEmail(clienteAtual.id, emailTrim)
        setAvisoEmail(
          'Enviamos um link para o e-mail atual e outro para o novo. É obrigatório confirmar os dois links (na mesma caixa do Gmail +alias aparecem dois e-mails distintos). Só depois o endereço muda.',
        )
        return
      }

      setMensagem('Cadastro atualizado.')
    } catch (e) {
      setAvisoEmail(null)
      setMensagem(null)
      setErro(
        e instanceof CadastroErro
          ? e.message
          : e instanceof Error && e.message
            ? e.message
            : 'Não foi possível salvar o cadastro.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="admin-painel">
      <header className="admin-painel__header">
        <div>
          <p className="admin-painel__eyebrow">Cadastro</p>
          <h1>Atualizar cadastro</h1>
        </div>
        <div className="admin-painel__acoes">
          <Link className="btn btn--ghost" to="/admin/painel">
            Voltar ao painel
          </Link>
        </div>
      </header>

      {avisoEmail && (
        <div className="admin-login__aviso-email" role="status">
          <p className="admin-login__aviso-email-titulo">Confirme o novo e-mail</p>
          <p className="admin-login__aviso-email-texto">{avisoEmail}</p>
        </div>
      )}

      {mensagem && !erro && !avisoEmail && (
        <div className="admin-login__aviso-email" role="status">
          <p className="admin-login__aviso-email-titulo">Cadastro atualizado</p>
          <p className="admin-login__aviso-email-texto">As alterações foram salvas.</p>
        </div>
      )}

      {erro && (
        <div className="admin-login__aviso-email admin-login__aviso-email--erro" role="alert">
          <p className="admin-login__aviso-email-titulo">Atenção</p>
          <p className="admin-login__aviso-email-texto">{erro}</p>
        </div>
      )}

      <section className="admin-painel__secao">
        <form className="admin-painel__form" onSubmit={(e) => void aoSalvar(e)}>
          <label className="admin-field">
            <span>Nome</span>
            <input
              type="text"
              name="nome"
              autoComplete="organization"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              disabled={salvando}
            />
          </label>

          <label className="admin-field">
            <span>Endereço da montagem</span>
            <input
              type="text"
              name="endereco"
              value={slug}
              onChange={(e) => {
                setSlug(gerarSlug(e.target.value))
                setErro((atual) =>
                  atual === 'Este endereço da montagem já está em uso.'
                    ? null
                    : atual,
                )
              }}
              onBlur={() => void aoVerificarEndereco()}
              autoComplete="off"
              spellCheck={false}
              required
              disabled={salvando}
              aria-describedby="endereco-montagem-dica"
            />
            <span id="endereco-montagem-dica" className="admin-field__dica">
              Aparece na URL, por exemplo /raffiner
            </span>
          </label>

          <label className="admin-field">
            <span>E-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={salvando}
            />
          </label>

          <label className="admin-field">
            <span>Logo</span>
            <input
              type="file"
              accept="image/*"
              onChange={aoEscolherLogo}
              disabled={salvando}
            />
          </label>

          {logoExibida && (
            <div className="admin-painel__logo-preview">
              <img src={logoExibida} alt={`Logo ${nome}`} />
            </div>
          )}

          <div className="admin-painel__form-acoes">
            <button type="submit" className="btn btn--primary" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar cadastro'}
            </button>
            <Link className="btn btn--ghost" to="/admin/painel">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </div>
  )
}
