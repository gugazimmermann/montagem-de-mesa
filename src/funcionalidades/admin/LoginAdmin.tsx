import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../autenticacao'
import './LoginAdmin.css'

export function LoginAdmin() {
  const navegar = useNavigate()
  const { cliente, carregando, entrar } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
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
    setEnviando(true)

    try {
      const resultado = await entrar(email, senha)
      if (!resultado) {
        setErro('E-mail ou senha inválidos.')
        return
      }
      navegar('/admin/painel', { replace: true })
    } catch {
      setErro('Não foi possível entrar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={aoEnviar}>
        <header className="admin-login__header">
          <h1>Admin</h1>
          <p>Entre com o e-mail e senha do seu cliente.</p>
        </header>

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

        <label className="admin-field">
          <span>Senha</span>
          <input
            type="password"
            name="senha"
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
            disabled={enviando}
          />
        </label>

        {erro && <p className="admin-login__erro" role="alert">{erro}</p>}

        <button
          type="submit"
          className="btn btn--primary admin-login__submit"
          disabled={enviando}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="admin-login__rodape">
          Não tem conta? <Link to="/cadastro">Cadastrar</Link>
        </p>
      </form>
    </div>
  )
}
