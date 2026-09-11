import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  CadastroErro,
  CadastroPendenteConfirmacao,
} from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import './LoginAdmin.css'

export function CadastroAdmin() {
  const navegar = useNavigate()
  const { cliente, carregando, cadastrar } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [avisoConfirmacao, setAvisoConfirmacao] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (carregando) {
    return (
      <div className="admin-login">
        <p className="admin-login__header">Carregando…</p>
      </div>
    )
  }

  if (cliente) {
    return <Navigate to="/admin/painel" replace />
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setAvisoConfirmacao(null)

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setEnviando(true)
    try {
      await cadastrar({ nome, email, senha })
      navegar('/admin/painel', { replace: true })
    } catch (e) {
      if (e instanceof CadastroPendenteConfirmacao) {
        setAvisoConfirmacao(e.message)
        return
      }
      setErro(
        e instanceof CadastroErro
          ? e.message
          : 'Não foi possível cadastrar. Tente novamente.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={aoEnviar}>
        <header className="admin-login__header">
          <h1>Cadastro</h1>
          <p>Crie a conta do cliente para acessar o painel.</p>
        </header>

        <label className="admin-field">
          <span>Nome</span>
          <input
            type="text"
            name="nome"
            autoComplete="organization"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            disabled={enviando || Boolean(avisoConfirmacao)}
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
            disabled={enviando || Boolean(avisoConfirmacao)}
          />
        </label>

        <label className="admin-field">
          <span>Senha</span>
          <input
            type="password"
            name="senha"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            minLength={6}
            disabled={enviando || Boolean(avisoConfirmacao)}
          />
        </label>

        <label className="admin-field">
          <span>Confirmar senha</span>
          <input
            type="password"
            name="confirmarSenha"
            autoComplete="new-password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            required
            minLength={6}
            disabled={enviando || Boolean(avisoConfirmacao)}
          />
        </label>

        {erro && <p className="admin-login__erro" role="alert">{erro}</p>}
        {avisoConfirmacao && (
          <p className="admin-login__ok" role="status">
            {avisoConfirmacao}
          </p>
        )}

        {!avisoConfirmacao && (
          <button
            type="submit"
            className="btn btn--primary admin-login__submit"
            disabled={enviando}
          >
            {enviando ? 'Cadastrando…' : 'Cadastrar'}
          </button>
        )}

        <p className="admin-login__rodape">
          Já tem conta? <Link to="/admin">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
