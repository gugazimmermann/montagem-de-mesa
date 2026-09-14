import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { solicitarRedefinicaoSenha } from '../../dados/repositorioClientes'
import { AdminAuthCard } from './AdminAuthCard'
import { AdminAlerta } from './AdminFeedback'
import * as ui from './adminClasses'
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
          <p className={ui.loginRodape}>
            <Link to="/admin">Voltar ao login</Link>
          </p>
        }
      >
        <div className={ui.loginAvisoEmail} role="status">
          <p className={ui.loginAvisoEmailTitulo}>Verifique seu e-mail</p>
          <p className={ui.loginAvisoEmailTexto}>
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
        <p className={ui.loginRodape}>
          <Link to="/admin">Voltar ao login</Link>
        </p>
      }
    >
      <form className={ui.loginForm} onSubmit={aoEnviar}>
        <label className={ui.field}>
          <span className={ui.fieldLabel}>E-mail</span>
          <input
            type="email"
            name="email"
            className={ui.fieldInput}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={enviando}
          />
        </label>

        {erro && (
          <AdminAlerta tipo="error" titulo="Atenção">
            {erro}
          </AdminAlerta>
        )}

        <button
          type="submit"
          className={`btn btn--primary ${ui.loginSubmit}`}
          disabled={enviando}
        >
          {enviando ? 'Enviando…' : 'Enviar link'}
        </button>
      </form>
    </AdminAuthCard>
  )
}
