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
        <figure className="landing__visual">
          <img
            src="/readme/readme.png"
            alt="Pré-visualização de uma mesa posta montada no app"
            width={960}
            height={640}
            decoding="async"
            fetchPriority="high"
          />
        </figure>
      </main>

      <section className="landing__how" aria-labelledby="landing-como">
        <h2 id="landing-como">Como funciona</h2>
        <ol className="landing__steps">
          <li>
            <strong>Cadastre o catálogo</strong>
            <span>Categorias, fotos e layout de etiqueta.</span>
          </li>
          <li>
            <strong>Compartilhe o link</strong>
            <span>Seu endereço público /slug para clientes e noivas.</span>
          </li>
          <li>
            <strong>Receba a montagem</strong>
            <span>Lead no painel, e-mail e WhatsApp com o look pronto.</span>
          </li>
        </ol>
        <p className="landing__pricing">
          14 dias grátis · plano mensal via Stripe · cancele quando quiser
        </p>
      </section>

      <footer className="landing__foot">
        <span>14 dias de avaliação · catálogo próprio · link público</span>
      </footer>
    </div>
  )
}
