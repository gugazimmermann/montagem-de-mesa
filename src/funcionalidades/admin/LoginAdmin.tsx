import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { clienteTemAcesso } from '../../compartilhado/tipos'
import { EntrarErro } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AdminAuthCard, AdminAuthCarregando } from './AdminAuthCard'
import { destinoPosLogin } from './adminUtils'
import { CampoSenha } from './CampoSenha'

export function LoginAdmin() {
  const navegar = useNavigate()
  const localizacao = useLocation()
  const { cliente, carregando, entrar, precisaRedefinirSenha } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (carregando) {
    return <AdminAuthCarregando mensagem="Carregando sessão…" />
  }

  if (precisaRedefinirSenha) {
    return <Navigate to="/admin/redefinir-senha" replace />
  }

  if (cliente) {
    const from = (localizacao.state as { from?: string } | null)?.from
    return (
      <Navigate
        to={destinoPosLogin(from, { temAcesso: clienteTemAcesso(cliente) })}
        replace
      />
    )
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
      const from = (localizacao.state as { from?: string } | null)?.from
      navegar(
        destinoPosLogin(from, { temAcesso: clienteTemAcesso(resultado) }),
        { replace: true },
      )
    } catch (e) {
      if (e instanceof EntrarErro) {
        setErro(e.message)
      } else {
        setErro('Não foi possível entrar. Tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AdminAuthCard
      titulo="Admin"
      subtitulo="Entre com o e-mail e senha do seu cliente."
      asForm
      onSubmit={aoEnviar}
      rodape={
        <>
          <p className="admin-login__rodape">
            <Link to="/admin/recuperar-senha">Esqueci a senha</Link>
          </p>
          <p className="admin-login__rodape">
            Não tem conta? <Link to="/cadastro">Cadastrar</Link>
          </p>
        </>
      }
    >
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
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
        disabled={enviando}
      />

      {erro && <p className="admin-login__erro" role="alert">{erro}</p>}

      <button
        type="submit"
        className="btn btn--primary admin-login__submit"
        disabled={enviando}
      >
        {enviando ? 'Entrando…' : 'Entrar'}
      </button>
    </AdminAuthCard>
  )
}
