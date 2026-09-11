import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  temErro: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { temErro: false }

  static getDerivedStateFromError(): State {
    return { temErro: true }
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error('Erro na interface:', erro, info.componentStack)
  }

  private recarregar = () => {
    window.location.assign('/')
  }

  render() {
    if (this.state.temErro) {
      return (
        <div className="admin-login">
          <div className="admin-login__card">
            <header className="admin-login__header">
              <h1>Algo deu errado</h1>
              <p>Recarregue a página para continuar.</p>
            </header>
            <button
              type="button"
              className="btn btn--primary admin-login__submit"
              onClick={this.recarregar}
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
