import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  atualizarCadastro,
  enderecoMontagemEmUso,
  gerarSlug,
} from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AdminAlerta } from './AdminFeedback'
import {
  AdminPaginaPainel,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { mapearErroCadastro, nomeExibicaoPendente } from './adminUtils'
import * as ui from './adminClasses'

/**
 * Fluxo focado para definir o nome de exibição (Display Name) do estabelecimento
 * e o endereço público — comum quando a conta veio do Dashboard Auth sem cadastro completo.
 */
export function NomeExibicaoAdmin() {
  const { cliente, definirCliente } = useAuth()
  const navegar = useNavigate()

  if (!cliente) return <AdminSessaoInvalida />

  return (
    <FormularioNomeExibicao
      clienteAtual={cliente}
      definirCliente={definirCliente}
      aoConcluir={() => navegar('/admin/painel', { replace: true })}
    />
  )
}

function FormularioNomeExibicao({
  clienteAtual,
  definirCliente,
  aoConcluir,
}: {
  clienteAtual: NonNullable<ReturnType<typeof useAuth>['cliente']>
  definirCliente: ReturnType<typeof useAuth>['definirCliente']
  aoConcluir: () => void
}) {
  const pendente = nomeExibicaoPendente(clienteAtual)
  const slugProvisorio = gerarSlug(
    (clienteAtual.email.split('@')[0] ?? '').trim(),
  )
  const slugAindaProvisorio =
    Boolean(slugProvisorio) && clienteAtual.slug === slugProvisorio

  const [nome, setNome] = useState(pendente ? '' : clienteAtual.nome)
  const [slug, setSlug] = useState(
    slugAindaProvisorio ? '' : clienteAtual.slug,
  )
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!pendente) return
    setNome('')
    if (slugAindaProvisorio) setSlug('')
  }, [pendente, slugAindaProvisorio, clienteAtual.id])

  if (!pendente && !slugAindaProvisorio) {
    return <Navigate to="/admin/painel/cadastro" replace />
  }

  async function aoVerificarEndereco() {
    const s = gerarSlug(slug)
    if (!s || s === clienteAtual.slug) return
    try {
      if (await enderecoMontagemEmUso(s, clienteAtual.id)) {
        setErro('Este endereço da montagem já está em uso.')
      }
    } catch {
      // ignora falha de verificação pontual
    }
  }

  async function aoSalvar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    const nomeTrim = nome.trim()
    const slugNormalizado = gerarSlug(slug.trim() || nomeTrim)

    if (!nomeTrim) {
      setErro('Informe o nome de exibição do estabelecimento.')
      return
    }
    if (!slugNormalizado) {
      setErro('Informe o endereço da montagem.')
      return
    }
    if (nomeExibicaoPendente({ nome: nomeTrim, email: clienteAtual.email })) {
      setErro('Escolha um nome diferente do prefixo do e-mail.')
      return
    }

    setSlug(slugNormalizado)
    setSalvando(true)
    try {
      if (await enderecoMontagemEmUso(slugNormalizado, clienteAtual.id)) {
        setErro('Este endereço da montagem já está em uso.')
        return
      }

      const atualizado = await atualizarCadastro(clienteAtual.id, {
        nome: nomeTrim,
        slug: slugNormalizado,
        logo: clienteAtual.logo,
        whatsapp: clienteAtual.whatsapp,
      })
      definirCliente(atualizado)
      aoConcluir()
    } catch (e) {
      setErro(mapearErroCadastro(e, 'Não foi possível salvar. Tente novamente.'))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <AdminPaginaPainel
      titulo="Nome de exibição"
      breadcrumb={[
        { rotulo: 'Painel', para: '/admin/painel' },
        { rotulo: 'Nome de exibição' },
      ]}
      voltarPara="/admin/painel"
      voltarRotulo="Voltar ao painel"
      alerta={
        erro ? (
          <AdminAlerta tipo="error" titulo="Atenção">
            {erro}
          </AdminAlerta>
        ) : (
          <AdminAlerta tipo="info" titulo="Complete seu cadastro">
            Defina como o estabelecimento aparece no painel e na página pública.
            Depois você pode ajustar logo e WhatsApp em{' '}
            <Link to="/admin/painel/cadastro">Atualizar cadastro</Link>.
          </AdminAlerta>
        )
      }
    >
      <section className={ui.painelSecao}>
        <form className={ui.painelForm} onSubmit={(e) => void aoSalvar(e)}>
          <label className={ui.field}>
            <span className={ui.fieldLabel}>Nome de exibição</span>
            <input
              className={ui.fieldInput}
              type="text"
              name="nome"
              autoComplete="organization"
              placeholder="Ex.: Raffiner"
              value={nome}
              onChange={(e) => {
                const valor = e.target.value
                setNome(valor)
                if (!slug.trim() || slug === gerarSlug(nome)) {
                  setSlug(gerarSlug(valor))
                }
              }}
              required
              disabled={salvando}
              aria-describedby="nome-exibicao-dica"
            />
            <span id="nome-exibicao-dica" className={ui.fieldDica}>
              Aparece no título do painel e na montagem pública.
            </span>
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
              placeholder="ex.: raffiner"
              aria-describedby="endereco-montagem-dica-nome"
            />
            <span id="endereco-montagem-dica-nome" className={ui.fieldDica}>
              URL pública, por exemplo /raffiner
            </span>
          </label>

          <div className={ui.painelFormAcoes}>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Salvar e continuar'}
            </button>
            <Link className="btn btn--ghost" to="/admin/painel">
              Agora não
            </Link>
          </div>
        </form>
      </section>
    </AdminPaginaPainel>
  )
}
