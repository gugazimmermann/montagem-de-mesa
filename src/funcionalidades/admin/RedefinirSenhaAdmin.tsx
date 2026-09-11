import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  atualizarSenha,
  CadastroErro,
  ouvirSessaoAuth,
} from '../../dados/repositorioClientes'
import { CampoSenha } from './CampoSenha'
import './LoginAdmin.css'

export function RedefinirSenhaAdmin() {
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [sessaoOk, setSessaoOk] = useState<boolean | null>(null)

  useEffect(() => {
    return ouvirSessaoAuth(setSessaoOk)
  }, [])

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setEnviando(true)
    try {
      await atualizarSenha(senha)
      navegar('/admin/painel', { replace: true })
    } catch (e) {
      setErro(
        e instanceof CadastroErro
          ? e.message
          : 'Não foi possível atualizar a senha. Tente novamente.',
      )
    } finally {
      setEnviando(false)
    }
  }

  if (sessaoOk === null) {
    return (
      <div className="admin-login">
        <p className="admin-login__header">Carregando…</p>
      </div>
    )
  }

  if (!sessaoOk) {
    return (
      <div className="admin-login">
        <div className="admin-login__card">
          <header className="admin-login__header">
            <h1>Link inválido</h1>
            <p>Este link de redefinição é inválido ou expirou.</p>
          </header>
          <p className="admin-login__rodape">
            <Link to="/admin/recuperar-senha">Solicitar novo link</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-login">
      <form className="admin-login__card" onSubmit={aoEnviar}>
        <header className="admin-login__header">
          <h1>Redefinir senha</h1>
          <p>Escolha uma nova senha para a conta.</p>
        </header>

        <CampoSenha
          label="Nova senha"
          name="senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          minLength={6}
          disabled={enviando}
        />

        <CampoSenha
          label="Confirmar senha"
          name="confirmarSenha"
          autoComplete="new-password"
          value={confirmarSenha}
          onChange={(e) => setConfirmarSenha(e.target.value)}
          required
          minLength={6}
          disabled={enviando}
        />

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
          {enviando ? 'Salvando…' : 'Salvar senha'}
        </button>

        <p className="admin-login__rodape">
          <Link to="/admin">Voltar ao login</Link>
        </p>
      </form>
    </div>
  )
}
