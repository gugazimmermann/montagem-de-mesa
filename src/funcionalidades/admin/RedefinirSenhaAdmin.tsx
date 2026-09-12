import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { atualizarSenha, ouvirSessaoAuth } from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import { AdminAuthCard, AdminAuthCarregando } from './AdminAuthCard'
import { AdminAlerta } from './AdminFeedback'
import {
  mapearErroCadastro,
  SENHA_MIN,
  validarSenhasIguais,
} from './adminUtils'
import { CampoSenha } from './CampoSenha'

export function RedefinirSenhaAdmin() {
  const navegar = useNavigate()
  const { limparPrecisaRedefinirSenha, precisaRedefinirSenha } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [sessaoOk, setSessaoOk] = useState<boolean | null>(null)
  const [eventoRecovery, setEventoRecovery] = useState(false)

  useEffect(() => {
    return ouvirSessaoAuth((tem, evento) => {
      if (evento === 'PASSWORD_RECOVERY') {
        setEventoRecovery(true)
        setSessaoOk(true)
        return
      }
      setSessaoOk(tem)
    })
  }, [])

  const podeRedefinir = Boolean(sessaoOk && (precisaRedefinirSenha || eventoRecovery))

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    const conflito = validarSenhasIguais(senha, confirmarSenha)
    if (conflito) {
      setErro(conflito)
      return
    }

    setEnviando(true)
    try {
      await atualizarSenha(senha)
      await limparPrecisaRedefinirSenha()
      navegar('/admin/painel', {
        replace: true,
        state: { flash: 'Senha atualizada com sucesso.' },
      })
    } catch (e) {
      setErro(
        mapearErroCadastro(e, 'Não foi possível atualizar a senha. Tente novamente.'),
      )
    } finally {
      setEnviando(false)
    }
  }

  if (sessaoOk === null) {
    return <AdminAuthCarregando />
  }

  if (!sessaoOk) {
    return (
      <AdminAuthCard
        titulo="Link inválido"
        subtitulo="Este link de redefinição é inválido ou expirou."
        rodape={
          <p className="admin-login__rodape">
            <Link to="/admin/recuperar-senha">Solicitar novo link</Link>
          </p>
        }
      >
        {null}
      </AdminAuthCard>
    )
  }

  // Sessão normal (sem recovery): não permite trocar senha sem o fluxo de e-mail.
  if (!podeRedefinir) {
    return <Navigate to="/admin/painel" replace />
  }

  return (
    <AdminAuthCard
      titulo="Redefinir senha"
      subtitulo="Escolha uma nova senha para a conta."
      asForm
      onSubmit={(e) => void aoEnviar(e)}
      rodape={
        <p className="admin-login__rodape">
          <Link to="/admin">Voltar ao login</Link>
        </p>
      }
    >
      <CampoSenha
        label="Nova senha"
        name="senha"
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        required
        minLength={SENHA_MIN}
        disabled={enviando}
      />

      <CampoSenha
        label="Confirmar senha"
        name="confirmarSenha"
        autoComplete="new-password"
        value={confirmarSenha}
        onChange={(e) => setConfirmarSenha(e.target.value)}
        required
        minLength={SENHA_MIN}
        disabled={enviando}
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
        {enviando ? 'Salvando…' : 'Salvar senha'}
      </button>
    </AdminAuthCard>
  )
}
