import { Link } from 'react-router-dom'
import './LandingPage.css'

/** Landing multi-tenant na raiz — demo em /raffiner. */
export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing__atmosphere" aria-hidden="true" />
      <main className="landing__hero">
        <p className="landing__eyebrow">Para lojas de mesa posta</p>
        <h1 className="landing__brand">Montagem de Mesa</h1>
        <p className="landing__lead">
          No celular ou no computador, o cliente monta a mesa, vê o resultado na
          hora e envia a composição pronta — por e-mail ou WhatsApp.
        </p>
        <div className="landing__ctas">
          <Link className="btn btn--primary" to="/cadastro">
            Começar 14 dias de avaliação
          </Link>
          <Link className="btn btn--ghost" to="/admin">
            Entrar
          </Link>
          <Link className="btn btn--ghost" to="/raffiner">
            Ver demonstração
          </Link>
        </div>
      </main>
      <footer className="landing__foot">
        <span>14 dias de avaliação · catálogo próprio · link público</span>
      </footer>
    </div>
  )
}
