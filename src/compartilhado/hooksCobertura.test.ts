import { act, createElement, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValor } from '../funcionalidades/autenticacao/auth-context'
import { useAuth } from '../funcionalidades/autenticacao/useAuth'
import { useFlashLocation } from '../funcionalidades/admin/useFlashLocation'
import { useObjectUrlPreview } from '../funcionalidades/admin/useObjectUrlPreview'
import {
  marcarMontagensVistas,
  useMontagensVistoAte,
} from '../funcionalidades/admin/montagensVistas'
import { useMontagemNaUrl } from '../funcionalidades/mesa/useMontagemNaUrl'
import {
  criarQueryClient,
  invalidarCatalogo,
  useDadosCliente,
} from '../funcionalidades/admin/useDadosCliente'
import { useRenovarUrlsAssinadas } from '../dados/useRenovarUrlsAssinadas'
import { INTERVALO_REASSINAR_MS } from '../dados/storage'
import type { DadosCliente } from '../compartilhado/tipos'

const carregar = vi.hoisted(() => vi.fn())
const renovar = vi.hoisted(() => vi.fn())

vi.mock('../dados/repositorioClientes', () => ({
  carregarDadosCliente: carregar,
  renovarUrlsAssinadas: renovar,
}))

const dados: DadosCliente = {
  nome: 'Loja',
  logo: '',
  corMarca: '',
  corFundo: '',
  categorias: [{ id: 'prato', rotulo: 'Prato', descricao: '' }],
  itens: [],
}

let root: Root | null = null
let host: HTMLDivElement | null = null

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  carregar.mockReset()
  renovar.mockReset()
})

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  vi.useRealTimers()
})

function render(node: ReactNode) {
  act(() => {
    root!.render(node)
  })
}

describe('hooks', () => {
  it('useAuth exige provider e lê o contexto', () => {
    function Solto() {
      useAuth()
      return null
    }
    expect(() => render(createElement(Solto))).toThrow(/AuthProvider/)

    const valor = {
      cliente: null,
      carregando: false,
      precisaRedefinirSenha: false,
      limparPrecisaRedefinirSenha: () => {},
      entrar: vi.fn(),
      cadastrar: vi.fn(),
      definirCliente: vi.fn(),
      sair: vi.fn(),
    } as unknown as AuthContextValor
    let lido: AuthContextValor | null = null
    function Dentro() {
      lido = useAuth()
      return null
    }
    render(
      createElement(AuthContext.Provider, { value: valor }, createElement(Dentro)),
    )
    expect(lido).toBe(valor)
  })

  it('useFlashLocation mostra e limpa o flash', () => {
    vi.useFakeTimers()
    let flash: string | null = 'inicio'
    let limpar = () => {}
    function Tela() {
      const hook = useFlashLocation()
      flash = hook.flash
      limpar = hook.limparFlash
      const navegar = useNavigate()
      useEffect(() => {
        navegar('/admin', { state: { flash: 'Salvo' } })
      }, [navegar])
      return null
    }
    render(createElement(MemoryRouter, null, createElement(Tela)))
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(flash).toBe('Salvo')
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(flash).toBeNull()
    act(() => limpar())
  })

  it('useObjectUrlPreview escolhe e limpa arquivo', () => {
    let escolher: (evento: { target: { files?: File[] } }) => void = () => {}
    let limpar = () => {}
    let preview: string | null = null
    function Tela() {
      const hook = useObjectUrlPreview()
      escolher = hook.escolher as typeof escolher
      limpar = hook.limpar
      preview = hook.preview
      return null
    }
    render(createElement(Tela))
    const arquivo = new File(['x'], 'a.png', { type: 'image/png' })
    act(() => {
      escolher({ target: { files: [arquivo] } })
    })
    expect(preview).toContain('blob:')
    act(() => {
      escolher({ target: {} })
    })
    act(() => limpar())
    expect(preview).toBeNull()
  })

  it('marca montagens vistas e o hook escuta o evento', () => {
    let ate: string | null = 'x'
    function Tela({ id }: { id?: string }) {
      ate = useMontagensVistoAte(id)
      return null
    }
    render(createElement(Tela, { id: undefined }))
    expect(ate).toBeNull()
    const iso = '2026-10-08T12:00:00.000Z'
    render(createElement(Tela, { id: 'cliente-1' }))
    act(() => {
      marcarMontagensVistas('cliente-1', 'invalido')
      marcarMontagensVistas('cliente-1', iso)
      marcarMontagensVistas('cliente-1', '2020-01-01T00:00:00.000Z')
    })
    expect(ate).toBe(iso)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('cheia')
    })
    marcarMontagensVistas('cliente-1', '2026-10-09T00:00:00.000Z')
    window.dispatchEvent(new Event('storage'))
  })

  it('sincroniza a montagem com a url', async () => {
    let config: Record<string, unknown> | null = null
    function Tela() {
      const hook = useMontagemNaUrl(
        [{ id: 'prato', rotulo: 'Prato', descricao: '' }],
        [
          {
            id: 'p1',
            nome: 'Raso',
            categoria: 'prato',
            cores: { primaria: '#fff' },
          },
        ],
      )
      config = hook.configuracao
      return null
    }
    vi.useFakeTimers()
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/loja?m=prato:p1'] },
        createElement(Tela),
      ),
    )
    expect(config).toMatchObject({ prato: 'p1' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
  })

  it('carrega dados do cliente e renova urls', async () => {
    expect(criarQueryClient()).toBeInstanceOf(QueryClient)
    const invalidador = new QueryClient()
    const spyInvalida = vi.spyOn(invalidador, 'invalidateQueries')
    await invalidarCatalogo(invalidador, 'c1')
    expect(spyInvalida).toHaveBeenCalled()
    carregar.mockImplementation(async (id: string) => {
      if (id === 'c2') throw new Error('conta')
      if (id === 'c3') throw 'falha'
      if (id === 'c4') return null
      return dados
    })
    renovar.mockResolvedValue({ ...dados, nome: 'Nova' })
    const cliente = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const visto = { nome: null as string | null, erro: null as string | null, id: '' }
    function Tela({ id }: { id?: string }) {
      const hook = useDadosCliente(id)
      visto.nome = hook.dados?.nome ?? null
      visto.erro = hook.erro
      visto.id = id ?? ''
      if (id === 'c1') {
        hook.setErro('ignorado')
        hook.setDados((prev) => prev)
        hook.setDados(dados)
      }
      if (!id) hook.setDados(dados)
      return null
    }
    render(
      createElement(
        QueryClientProvider,
        { client: cliente },
        createElement(Tela, { id: undefined }),
      ),
    )
    expect(visto.nome).toBeNull()

    render(
      createElement(
        QueryClientProvider,
        { client: cliente },
        createElement(Tela, { id: 'c1' }),
      ),
    )
    await vi.waitFor(() => expect(visto.nome).toBe('Loja'))

    const outro = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      createElement(
        QueryClientProvider,
        { client: outro },
        createElement(Tela, { id: 'c2' }),
      ),
    )
    await vi.waitFor(() => expect(visto.erro).toBe('conta'))

    const terceiro = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      createElement(
        QueryClientProvider,
        { client: terceiro },
        createElement(Tela, { id: 'c3' }),
      ),
    )
    await vi.waitFor(() => expect(visto.erro).toMatch(/carregar/))

    const quarto = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      createElement(
        QueryClientProvider,
        { client: quarto },
        createElement(Tela, { id: 'c4' }),
      ),
    )
    await vi.waitFor(() => expect(visto.erro).toMatch(/não encontrada/))
  })

  it('renova urls assinadas só quando a aba está visível', async () => {
    vi.useFakeTimers()
    const atualizar = vi.fn()
    function Tela() {
      useRenovarUrlsAssinadas(dados, atualizar)
      return null
    }
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    renovar.mockResolvedValue({ ...dados, nome: 'Renovada' })
    render(createElement(Tela))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_REASSINAR_MS + 60_000)
    })
    expect(atualizar).toHaveBeenCalled()

    renovar.mockResolvedValue(dados)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_REASSINAR_MS + 60_000)
    })

    renovar.mockRejectedValue(new Error('rede'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(INTERVALO_REASSINAR_MS + 60_000)
    })

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(renovar).toHaveBeenCalled()
  })
})
