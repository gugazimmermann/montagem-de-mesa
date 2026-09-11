import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { solicitarRedefinicaoSenha } from '../../dados/repositorioClientes'
import { AdminAuthCard } from './AdminAuthCard'
import { mapearErroCadastro } from './adminUtils'

export function RecuperarSenhaAdmin() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setEnviando(true)

    try {
      await solicitarRedefinicaoSenha(email)
      setEnviado(true)
    } catch (e) {
      setErro(
        mapearErroCadastro(e, 'Não foi possível enviar o e-mail. Tente novamente.'),
      )
    } finally {
      setEnviando(false)
    }
  }

  if (enviado) {
    return (
      <AdminAuthCard
        titulo="Recuperar senha"
        rodape={
          <p className="admin-login__rodape">
            <Link to="/admin">Voltar ao login</Link>
          </p>
        }
      >
        <div className="admin-login__aviso-email" role="status">
          <p className="admin-login__aviso-email-titulo">Verifique seu e-mail</p>
          <p className="admin-login__aviso-email-texto">
            Se existir uma conta com este e-mail, você receberá um link para redefinir a
            senha.
          </p>
        </div>
      </AdminAuthCard>
    )
  }

  return (
    <AdminAuthCard
      titulo="Recuperar senha"
      subtitulo="Informe o e-mail da conta para receber o link de redefinição."
      rodape={
        <p className="admin-login__rodape">
          <Link to="/admin">Voltar ao login</Link>
        </p>
      }
    >
      <form className="admin-login__form" onSubmit={aoEnviar}>
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

        {erro && (
          <p className="admin-login__erro" role="alert">
            {erro}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary admin-login__submit"
          disabled={enviando}
        >
          {enviando ? 'Enviando…' : 'Enviar link'}
        </button>
      </form>
    </AdminAuthCard>
  )
}
