import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  atualizarCadastro,
  CadastroErro,
  enderecoMontagemEmUso,
  formatarWhatsapp,
  gerarSlug,
  normalizarWhatsapp,
  obterSessaoCliente,
  solicitarTrocaEmail,
} from '../../dados/repositorioClientes'
import { enviarLogoStorage, exigirUrlStorageOuVazio } from '../../dados/storage'
import { supabase } from '../../dados/supabase'
import { useAuth } from '../autenticacao'
import { AdminAlerta } from './AdminFeedback'
import {
  AdminPaginaPainel,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { mapearErroCadastro, mapearErroUpload } from './adminUtils'
import * as ui from './adminClasses'
import { useObjectUrlPreview } from './useObjectUrlPreview'

function limparHashUrl() {
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
}

export function AtualizarCadastroAdmin() {
  const { cliente, definirCliente } = useAuth()

  if (!cliente) {
    return <AdminSessaoInvalida />
  }

  return <FormularioAtualizarCadastro clienteAtual={cliente} definirCliente={definirCliente} />
}

function FormularioAtualizarCadastro({
  clienteAtual,
  definirCliente,
}: {
  clienteAtual: NonNullable<ReturnType<typeof useAuth>['cliente']>
  definirCliente: ReturnType<typeof useAuth>['definirCliente']
}) {

  const [nome, setNome] = useState(clienteAtual.nome)
  const [slug, setSlug] = useState(clienteAtual.slug)
  const [email, setEmail] = useState(clienteAtual.email)
  const [whatsapp, setWhatsapp] = useState(() => formatarWhatsapp(clienteAtual.whatsapp))
  const [logo, setLogo] = useState(clienteAtual.logo)
  const {
    arquivo: arquivoLogo,
    preview: previewLogo,
    escolher: aoEscolherLogo,
    limpar: limparPreviewLogo,
    accept: acceptLogo,
  } = useObjectUrlPreview()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [avisoEmail, setAvisoEmail] = useState<string | null>(null)
  const [emailNovoPendente, setEmailNovoPendente] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const salvandoRef = useRef(false)

  useEffect(() => {
    setNome(clienteAtual.nome)
    setSlug(clienteAtual.slug)
    setEmail(clienteAtual.email)
    setWhatsapp(formatarWhatsapp(clienteAtual.whatsapp))
    setLogo(clienteAtual.logo)
  }, [
    clienteAtual.nome,
    clienteAtual.slug,
    clienteAtual.email,
    clienteAtual.whatsapp,
    clienteAtual.logo,
  ])

  useEffect(() => {
    const bruto = window.location.hash.replace(/^#/, '')
    if (!bruto) return

    const params = new URLSearchParams(bruto)
    const message = (params.get('message') ?? '').toLowerCase()

    // Mensagens intermediárias do fluxo antigo (dois links); com confirmação só no novo,
    // o fluxo completo chega com access_token / type=email_change.
    if (
      message.includes('other email') ||
      message.includes('confirmation link accepted')
    ) {
      setAvisoEmail(
        'Abra o link enviado ao e-mail novo para concluir a troca.',
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
          setWhatsapp(formatarWhatsapp(sessao.whatsapp))
          setLogo(sessao.logo)
          setAvisoEmail(null)
          setEmailNovoPendente('')
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

  const logoExibida = previewLogo || logo

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
    if (salvandoRef.current) return
    salvandoRef.current = true
    setErro(null)
    setMensagem(null)
    // Não limpa avisoEmail se a troca ainda está pendente — evita “sumir” o banner no re-save.
    if (!emailNovoPendente) setAvisoEmail(null)

    const nomeTrim = nome.trim()
    const slugNormalizado = gerarSlug(slug)
    const emailTrim = email.trim().toLowerCase()
    const whatsappNormalizado = normalizarWhatsapp(whatsapp)

    if (!nomeTrim) {
      setErro('Informe o nome do cliente.')
      salvandoRef.current = false
      return
    }
    if (!slugNormalizado) {
      setErro('Informe o endereço da montagem.')
      salvandoRef.current = false
      return
    }
    if (!emailTrim) {
      setErro('Informe o e-mail.')
      salvandoRef.current = false
      return
    }
    if (whatsapp.trim() && whatsappNormalizado.length < 12) {
      setErro('Informe um WhatsApp válido com DDD, por exemplo (11) 99999-9999.')
      salvandoRef.current = false
      return
    }

    setSlug(slugNormalizado)

    setSalvando(true)
    try {
      let logoFinal = logo.trim() || clienteAtual.logo
      if (arquivoLogo) {
        logoFinal = await enviarLogoStorage(clienteAtual.id, arquivoLogo)
      } else if (logoFinal) {
        logoFinal = exigirUrlStorageOuVazio(logoFinal, 'Logo', {
          clienteId: clienteAtual.id,
          tipo: 'logo',
        })
      }

      const atualizado = await atualizarCadastro(clienteAtual.id, {
        nome: nomeTrim,
        slug: slugNormalizado,
        logo: logoFinal,
        whatsapp: whatsappNormalizado,
      })

      definirCliente(atualizado)
      setLogo(logoFinal)
      setSlug(atualizado.slug)
      setWhatsapp(formatarWhatsapp(atualizado.whatsapp))
      if (previewLogo) {
        limparPreviewLogo()
      }

      if (emailTrim !== clienteAtual.email) {
        const jaPendente = emailNovoPendente === emailTrim
        try {
          if (!jaPendente) {
            await solicitarTrocaEmail(clienteAtual.id, emailTrim)
          }
          setMensagem('Cadastro salvo.')
          setEmailNovoPendente(emailTrim)
          setAvisoEmail(
            jaPendente
              ? `A troca para ${emailTrim} já está pendente. Use “Reenviar e-mail” se precisar do link de novo.`
              : `Enviamos um link para ${emailTrim}. Confirme esse e-mail para concluir a troca.`,
          )
        } catch (eEmail) {
          setMensagem('Cadastro salvo.')
          setErro(
            eEmail instanceof CadastroErro
              ? `Não foi possível iniciar a troca de e-mail: ${eEmail.message}`
              : 'Cadastro salvo, mas não foi possível iniciar a troca de e-mail.',
          )
        }
        return
      }

      setMensagem('Cadastro atualizado.')
    } catch (e) {
      setAvisoEmail(null)
      setMensagem(null)
      setErro(mapearErroUpload(e, 'Não foi possível salvar o cadastro.'))
    } finally {
      salvandoRef.current = false
      setSalvando(false)
    }
  }

  return (
    <AdminPaginaPainel
      titulo="Atualizar cadastro"
      breadcrumb={[
        { rotulo: 'Painel', para: '/admin/painel' },
        { rotulo: 'Cadastro' },
      ]}
      voltarPara="/admin/painel"
      voltarRotulo="Voltar ao painel"
      alerta={
        avisoEmail || mensagem || erro ? (
          <>
            {avisoEmail && (
              <AdminAlerta tipo="warning" titulo="Troca de e-mail em andamento">
                <ol className={ui.emailPassos}>
                  <li className="is-ativo">
                    1. Link enviado
                    {emailNovoPendente ? ` para ${emailNovoPendente}` : ''}
                  </li>
                  <li>2. Confirmar o link no e-mail novo</li>
                </ol>
                <p>{avisoEmail}</p>
                {emailNovoPendente && (
                  <p>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={salvando}
                      onClick={() => {
                        void (async () => {
                          setSalvando(true)
                          setErro(null)
                          try {
                            await solicitarTrocaEmail(clienteAtual.id, emailNovoPendente, {
                              forcarReenvio: true,
                            })
                            setAvisoEmail(
                              `Reenviamos o link de confirmação para ${emailNovoPendente}.`,
                            )
                          } catch (e) {
                            setErro(
                              mapearErroCadastro(e, 'Não foi possível reenviar o e-mail.'),
                            )
                          } finally {
                            setSalvando(false)
                          }
                        })()
                      }}
                    >
                      Reenviar e-mail
                    </button>
                  </p>
                )}
              </AdminAlerta>
            )}

            {mensagem && (
              <AdminAlerta tipo="success" titulo="Cadastro atualizado">
                {erro
                  ? 'Nome, endereço e logo foram salvos.'
                  : 'As alterações foram salvas.'}
              </AdminAlerta>
            )}

            {erro && (
              <AdminAlerta tipo="error" titulo="Atenção">
                {erro}
              </AdminAlerta>
            )}
          </>
        ) : null
      }
    >
      <section className={ui.painelSecao}>
        <form className={ui.painelForm} onSubmit={(e) => void aoSalvar(e)}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Nome</span>
            <input
              className={ui.fieldInput}
              type="text"
              name="nome"
              autoComplete="organization"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              disabled={salvando}
            />
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Endereço da montagem</span>
            <input
              className={ui.fieldInput}
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
            <span id="endereco-montagem-dica" className={ui.fieldDica}>
              Aparece na URL, por exemplo /raffiner
            </span>
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>E-mail</span>
            <input
              className={ui.fieldInput}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={salvando || Boolean(avisoEmail)}
            />
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>WhatsApp</span>
            <input
              className={ui.fieldInput}
              type="tel"
              name="whatsapp"
              autoComplete="tel-national"
              inputMode="numeric"
              value={whatsapp}
              onChange={(e) => setWhatsapp(formatarWhatsapp(e.target.value))}
              disabled={salvando}
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
          </label>

          <label className={ui.field}>
            <span className={ui.fieldLabel}>Logo</span>
            <input
              className={ui.fieldInput}
              type="file"
              accept={acceptLogo}
              onChange={(e) => {
                aoEscolherLogo(e)
                setMensagem(null)
                setErro(null)
              }}
              disabled={salvando}
            />
          </label>

          {logoExibida && (
            <div className={ui.painelLogoPreview}>
              <img src={logoExibida} alt={`Logo ${nome}`} />
            </div>
          )}

          <div className={ui.painelFormAcoes}>
            <button type="submit" className="btn btn--primary" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar cadastro'}
            </button>
            <Link className="btn btn--ghost" to="/admin/painel">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </AdminPaginaPainel>
  )
}
