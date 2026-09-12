import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  CadastroPendenteConfirmacao,
  reenviarEmailConfirmacao,
} from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AdminAuthCard, AdminAuthCarregando } from './AdminAuthCard'
import { AdminAlerta } from './AdminFeedback'
import {
  mapearErroCadastro,
  SENHA_MIN,
  validarSenhasIguais,
} from './adminUtils'
import { CampoSenha } from './CampoSenha'

export function CadastroAdmin() {
  const navegar = useNavigate()
  const { cliente, carregando, cadastrar } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [avisoConfirmacao, setAvisoConfirmacao] = useState<string | null>(null)
  const [emailPendente, setEmailPendente] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [reenviando, setReenviando] = useState(false)

  if (carregando) {
    return <AdminAuthCarregando />
  }

  if (cliente) {
    return <Navigate to="/admin/painel" replace />
  }

  function checarSenhas(s: string, c: string) {
    const msg = validarSenhasIguais(s, c)
    setErroSenha(msg)
    return msg === null
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setAvisoConfirmacao(null)

    if (!checarSenhas(senha, confirmarSenha)) return

    setEnviando(true)
    try {
      await cadastrar({ nome, email, senha })
      navegar('/admin/painel', { replace: true })
    } catch (e) {
      if (e instanceof CadastroPendenteConfirmacao) {
        setEmailPendente(email.trim().toLowerCase())
        setAvisoConfirmacao(e.message)
        return
      }
      setErro(mapearErroCadastro(e, 'Não foi possível cadastrar. Tente novamente.'))
    } finally {
      setEnviando(false)
    }
  }

  async function aoReenviar() {
    if (!emailPendente) return
    setReenviando(true)
    setErro(null)
    try {
      await reenviarEmailConfirmacao(emailPendente)
      setAvisoConfirmacao(
        'Enviamos outro e-mail de confirmação. Verifique a caixa de entrada.',
      )
    } catch (e) {
      setErro(mapearErroCadastro(e, 'Falha ao reenviar.'))
    } finally {
      setReenviando(false)
    }
  }

  if (avisoConfirmacao) {
    return (
      <AdminAuthCard
        titulo="Cadastro"
        subtitulo="Crie a conta do cliente para acessar o painel."
        rodape={
          <p className="admin-login__rodape">
            Já confirmou? <Link to="/admin">Entrar</Link>
          </p>
        }
      >
        <AdminAlerta tipo="success" titulo="Confirme seu e-mail">
          <p>{avisoConfirmacao}</p>
          <p>
            Enviado para <strong>{emailPendente}</strong>.
          </p>
        </AdminAlerta>
        {erro && <AdminAlerta tipo="error">{erro}</AdminAlerta>}
        <button
          type="button"
          className="btn btn--primary admin-login__submit"
          disabled={reenviando}
          onClick={() => void aoReenviar()}
        >
          {reenviando ? 'Reenviando…' : 'Reenviar e-mail'}
        </button>
        <button
          type="button"
          className="btn btn--ghost admin-login__submit"
          onClick={() => {
            setAvisoConfirmacao(null)
            setEmailPendente('')
            setErro(null)
          }}
        >
          Usar outro e-mail
        </button>
      </AdminAuthCard>
    )
  }

  return (
    <AdminAuthCard
      titulo="Cadastro"
      subtitulo="Crie a conta do cliente para acessar o painel."
      rodape={
        <p className="admin-login__rodape">
          Já tem conta? <Link to="/admin">Entrar</Link>
        </p>
      }
    >
      <form className="admin-login__form" onSubmit={aoEnviar}>
        <label className="admin-field">
          <span>Nome</span>
          <input
            type="text"
            name="nome"
            autoComplete="organization"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            disabled={enviando}
          />
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
            disabled={enviando}
          />
        </label>

        <CampoSenha
          label="Senha"
          name="senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => {
            setSenha(e.target.value)
            if (confirmarSenha) checarSenhas(e.target.value, confirmarSenha)
          }}
          required
          minLength={SENHA_MIN}
          disabled={enviando}
          dica={`Mínimo de ${SENHA_MIN} caracteres`}
        />

        <CampoSenha
          label="Confirmar senha"
          name="confirmarSenha"
          autoComplete="new-password"
          value={confirmarSenha}
          onChange={(e) => {
            setConfirmarSenha(e.target.value)
            checarSenhas(senha, e.target.value)
          }}
          onBlur={() => checarSenhas(senha, confirmarSenha)}
          required
          minLength={SENHA_MIN}
          disabled={enviando}
          invalido={Boolean(erroSenha)}
          mensagemErro={erroSenha}
        />

        {erro && (
          <AdminAlerta tipo="error" titulo="Atenção">
            {erro}
          </AdminAlerta>
        )}

        <button
          type="submit"
          className="btn btn--primary admin-login__submit"
          disabled={enviando}
        >
          {enviando ? 'Cadastrando…' : 'Cadastrar'}
        </button>
      </form>
    </AdminAuthCard>
  )
}
