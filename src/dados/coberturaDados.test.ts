import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemMesa } from '../compartilhado/tipos'
import { CadastroErro } from './erros'

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

const rpc = vi.hoisted(() => vi.fn())
const from = vi.hoisted(() => vi.fn())
const invoke = vi.hoisted(() => vi.fn())
const storageFrom = vi.hoisted(() => vi.fn())

vi.mock('./supabase', () => ({
  supabase: {
    auth,
    rpc,
    from,
    functions: { invoke },
    storage: { from: storageFrom },
  },
}))

function consulta(resultado: {
  data?: unknown
  error?: { message?: string; code?: string } | null
  count?: number | null
}) {
  const payload = {
    data: resultado.data ?? null,
    error: resultado.error ?? null,
    count: resultado.count ?? null,
  }
  const q: Record<string, unknown> = {}
  const encadear = () => q
  for (const metodo of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'is',
    'order',
    'range',
    'gte',
    'lte',
    'gt',
    'lt',
    'or',
    'limit',
    'neq',
    'in',
  ]) {
    q[metodo] = encadear
  }
  q.maybeSingle = () => Promise.resolve(payload)
  q.single = () => Promise.resolve(payload)
  q.then = (
    resolve: (valor: unknown) => unknown,
    reject?: (erro: unknown) => unknown,
  ) => Promise.resolve(payload).then(resolve, reject)
  return q
}

const CLIENTE_ID = '00978f7b-9737-40b0-a705-831084d1a7d4'
const CATEGORIA_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const ITEM_ID = 'f1e2d3c4-b5a6-9780-1234-56789abcdef0'

const categoria = {
  id: CATEGORIA_ID,
  codigo: 'pratoRaso',
  rotulo: 'Prato raso',
  descricao: 'Principal',
}

const itemMesa: ItemMesa = {
  id: ITEM_ID,
  nome: 'Prato branco',
  categoria: CATEGORIA_ID,
  imagem: `${CLIENTE_ID}/${CATEGORIA_ID}/${ITEM_ID}.webp`,
  cores: { primaria: '#fff', secundaria: '#eee' },
  largura: 27,
  comprimento: 27,
  descricao: 'Liso',
}

function filaConsultas(resultados: Array<Parameters<typeof consulta>[0]>) {
  const pendentes = [...resultados]
  from.mockImplementation(() => consulta(pendentes.shift() ?? { data: null }))
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.signOut.mockResolvedValue({ error: null })
  auth.updateUser.mockResolvedValue({ error: null })
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
  storageFrom.mockImplementation(() => ({
    createSignedUrls: vi.fn(async (paths: string[]) => ({
      data: paths.map((path) => ({
        path,
        signedUrl: `https://signed.example/${path}`,
      })),
      error: null,
    })),
    upload: vi.fn(async () => ({ error: null })),
  }))
  rpc.mockResolvedValue({ data: null, error: null })
})

describe('repositório de catálogo', () => {
  it('cria, atualiza, exclui e reordena', async () => {
    const catalogo = await import('./repositorioCatalogo')
    rpc.mockResolvedValueOnce({ data: 3, error: null })
    filaConsultas([{ data: null, error: null }])
    await catalogo.criarCategoria(CLIENTE_ID, categoria)
    expect(rpc).toHaveBeenCalledWith('proximo_ordem_categoria', {
      p_cliente_id: CLIENTE_ID,
    })

    rpc.mockResolvedValueOnce({ data: 'nao-numero', error: null })
    filaConsultas([{ error: { message: 'falha insert' } }])
    await expect(catalogo.criarCategoria(CLIENTE_ID, categoria)).rejects.toMatchObject({
      message: 'falha insert',
    })

    rpc.mockResolvedValueOnce({ error: { message: 'rpc' } })
    await expect(catalogo.criarCategoria(CLIENTE_ID, categoria)).rejects.toMatchObject({
      message: 'rpc',
    })

    filaConsultas([{ data: { id: CATEGORIA_ID }, error: null }])
    await catalogo.atualizarCategoria(CLIENTE_ID, { ...categoria, codigo: null })

    filaConsultas([{ data: null, error: null }])
    await expect(
      catalogo.atualizarCategoria(CLIENTE_ID, categoria),
    ).rejects.toBeInstanceOf(CadastroErro)

    filaConsultas([{ error: { message: 'update' } }])
    await expect(
      catalogo.atualizarCategoria(CLIENTE_ID, categoria),
    ).rejects.toMatchObject({ message: 'update' })

    filaConsultas([
      { error: null },
      { data: { id: CATEGORIA_ID }, error: null },
    ])
    await catalogo.excluirCategoriaDb(CLIENTE_ID, CATEGORIA_ID)

    filaConsultas([{ error: { message: 'itens' } }])
    await expect(
      catalogo.excluirCategoriaDb(CLIENTE_ID, CATEGORIA_ID),
    ).rejects.toMatchObject({ message: 'itens' })

    filaConsultas([{ error: null }, { error: { message: 'cat' } }])
    await expect(
      catalogo.excluirCategoriaDb(CLIENTE_ID, CATEGORIA_ID),
    ).rejects.toMatchObject({ message: 'cat' })

    filaConsultas([{ error: null }, { data: null, error: null }])
    await expect(
      catalogo.excluirCategoriaDb(CLIENTE_ID, CATEGORIA_ID),
    ).rejects.toBeInstanceOf(CadastroErro)

    rpc.mockResolvedValueOnce({ data: 1, error: null })
    filaConsultas([{ error: null }])
    await catalogo.criarItem(CLIENTE_ID, itemMesa)

    rpc.mockResolvedValueOnce({ data: 1, error: null })
    filaConsultas([{ error: { message: 'item' } }])
    await expect(catalogo.criarItem(CLIENTE_ID, { ...itemMesa, padrao: 'solid' })).rejects.toMatchObject({
      message: 'item',
    })

    rpc.mockResolvedValueOnce({ error: { message: 'ordem item' } })
    await expect(catalogo.criarItem(CLIENTE_ID, itemMesa)).rejects.toMatchObject({
      message: 'ordem item',
    })

    filaConsultas([{ data: { id: ITEM_ID }, error: null }])
    await catalogo.atualizarItem(CLIENTE_ID, itemMesa)

    filaConsultas([{ data: null, error: null }])
    await expect(catalogo.atualizarItem(CLIENTE_ID, itemMesa)).rejects.toBeInstanceOf(
      CadastroErro,
    )

    filaConsultas([{ error: { message: 'upd item' } }])
    await expect(catalogo.atualizarItem(CLIENTE_ID, itemMesa)).rejects.toMatchObject({
      message: 'upd item',
    })

    filaConsultas([{ data: { id: ITEM_ID }, error: null }])
    await catalogo.excluirItemDb(CLIENTE_ID, ITEM_ID)

    filaConsultas([{ data: null, error: null }])
    await expect(catalogo.excluirItemDb(CLIENTE_ID, ITEM_ID)).rejects.toBeInstanceOf(
      CadastroErro,
    )

    filaConsultas([{ error: { message: 'del' } }])
    await expect(catalogo.excluirItemDb(CLIENTE_ID, ITEM_ID)).rejects.toMatchObject({
      message: 'del',
    })

    rpc.mockResolvedValueOnce({ error: null })
    await catalogo.trocarOrdemCategoria(CLIENTE_ID, 'a', 'b')
    rpc.mockResolvedValueOnce({ error: { message: 'ordem' } })
    await expect(
      catalogo.trocarOrdemCategoria(CLIENTE_ID, 'a', 'b'),
    ).rejects.toMatchObject({ message: 'ordem' })

    rpc.mockResolvedValueOnce({ error: null })
    await catalogo.trocarOrdemItem(CLIENTE_ID, CATEGORIA_ID, 'a', 'b')
    rpc.mockResolvedValueOnce({ error: { message: 'ordem item' } })
    await expect(
      catalogo.trocarOrdemItem(CLIENTE_ID, CATEGORIA_ID, 'a', 'b'),
    ).rejects.toMatchObject({ message: 'ordem item' })
  })
})

describe('funil', () => {
  it('registra visita e resume envios e visitas', async () => {
    const funil = await import('./repositorioFunil')
    rpc.mockResolvedValueOnce({ error: null })
    await funil.registrarVisitaCatalogo('loja')
    rpc.mockResolvedValueOnce({ error: { message: 'visita' } })
    await expect(funil.registrarVisitaCatalogo('loja')).rejects.toMatchObject({
      message: 'visita',
    })

    const hoje = new Date()
    const dia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(hoje)
    filaConsultas([
      {
        data: [
          { dia, total: 4 },
          { dia: '2000-01-01', total: 2 },
          { dia: 1, total: 'x' },
        ],
        error: null,
      },
      { count: 1, error: null },
      { count: null, error: null },
    ])
    const resumo = await funil.carregarResumoFunil(CLIENTE_ID)
    expect(resumo.envios7).toBe(1)
    expect(resumo.envios30).toBe(0)
    expect(resumo.visitas30).toBeGreaterThan(0)

    filaConsultas([
      { error: { message: 'visitas' } },
      { count: 2, error: null },
      { count: 3, error: null },
    ])
    const semVisitas = await funil.carregarResumoFunil(CLIENTE_ID)
    expect(semVisitas.visitas7).toBeNull()
    expect(semVisitas.envios30).toBe(3)

    filaConsultas([
      { data: [], error: null },
      { count: null, error: { message: 'contagem' } },
    ])
    await expect(funil.carregarResumoFunil(CLIENTE_ID)).rejects.toMatchObject({
      message: 'contagem',
    })
  })
})

describe('montagens enviadas', () => {
  const row = {
    id: 'm1',
    cliente_id: CLIENTE_ID,
    visitante_nome: 'Ana',
    visitante_email: 'a@b.co',
    visitante_whatsapp: '5511',
    visitante_endereco: 'Rua 1',
    visitante_cidade: 'São Paulo',
    visitante_estado: 'SP',
    itens: [
      { categoria: 'Prato', nome: 'Raso' },
      { categoria: '  ', nome: 'x' },
      { categoria: 'Ok', nome: '' },
      null,
      'texto',
      { categoria: 1, nome: 'n' },
    ],
    link_montagem: 'https://exemplo.test/loja?m=1',
    created_at: '2026-10-08T12:00:00.000Z',
    email_status: 'sent',
    lead_status: 'contatado',
    nota_interna: 'oi',
  }

  it('lista, conta e atualiza leads', async () => {
    const repo = await import('./repositorioMontagens')
    filaConsultas([{ data: [row, { ...row, email_status: 'nope', lead_status: null, nota_interna: null, itens: null }], error: null }])
    const pagina = await repo.listarMontagensEnviadas(CLIENTE_ID, {
      busca: 'Ana_%()',
      leadStatus: 'contatado',
      desde: '2026-10-01T00:00:00.000Z',
      ate: '2026-10-08T23:59:59.000Z',
      offset: 0,
      limit: 2,
    })
    expect(pagina.itens[0]?.itens).toEqual([{ categoria: 'Prato', nome: 'Raso' }])
    expect(pagina.itens[1]?.emailStatus).toBe('pending')
    expect(pagina.itens[1]?.leadStatus).toBe('novo')
    expect(pagina.temMais).toBe(true)

    filaConsultas([{ data: [], error: null }])
    const vazia = await repo.listarMontagensEnviadas(CLIENTE_ID, {
      busca: '%%%',
      leadStatus: 'todos',
    })
    expect(vazia.temMais).toBe(false)

    filaConsultas([{ error: { message: 'lista' } }])
    await expect(repo.listarMontagensEnviadas(CLIENTE_ID)).rejects.toMatchObject({
      message: 'lista',
    })

    filaConsultas([{ count: 4, error: null }])
    expect(
      await repo.contarMontagensNovas(CLIENTE_ID, { criadasApos: '2026-01-01' }),
    ).toBe(4)
    filaConsultas([{ count: null, error: null }])
    expect(await repo.contarMontagensNovas(CLIENTE_ID)).toBe(0)
    filaConsultas([{ error: { message: 'count' } }])
    await expect(repo.contarMontagensNovas(CLIENTE_ID)).rejects.toMatchObject({
      message: 'count',
    })

    filaConsultas([{ count: 2, error: null }])
    expect(await repo.contarLeadsNovosParados(CLIENTE_ID, '2026-10-01')).toBe(2)
    filaConsultas([{ error: { message: 'parados' } }])
    await expect(
      repo.contarLeadsNovosParados(CLIENTE_ID, '2026-10-01'),
    ).rejects.toMatchObject({ message: 'parados' })

    filaConsultas([{ data: { created_at: '2026-10-08T00:00:00.000Z' }, error: null }])
    expect(await repo.createdAtMontagemNovaMaisRecente(CLIENTE_ID)).toContain('2026-10-08')
    filaConsultas([{ data: null, error: null }])
    expect(await repo.createdAtMontagemNovaMaisRecente(CLIENTE_ID)).toBeNull()
    filaConsultas([{ error: { message: 'recente' } }])
    await expect(repo.createdAtMontagemNovaMaisRecente(CLIENTE_ID)).rejects.toMatchObject({
      message: 'recente',
    })

    filaConsultas([{ data: row, error: null }])
    const atualizada = await repo.atualizarLeadMontagem(CLIENTE_ID, 'm1', {
      leadStatus: 'fechado',
      notaInterna: 'x'.repeat(2500),
    })
    expect(atualizada.leadStatus).toBe('contatado')

    filaConsultas([{ data: null, error: null }])
    await expect(
      repo.atualizarLeadMontagem(CLIENTE_ID, 'm1', {}),
    ).rejects.toThrow(/não encontrada/i)

    filaConsultas([{ error: { message: 'upd' } }])
    await expect(
      repo.atualizarLeadMontagem(CLIENTE_ID, 'm1', { leadStatus: 'arquivado' }),
    ).rejects.toMatchObject({ message: 'upd' })
  })

  it('reenvia e-mail com os erros da função', async () => {
    const { reenviarEmailMontagem } = await import('./repositorioMontagens')
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null })
    await reenviarEmailMontagem('m1')

    invoke.mockResolvedValueOnce({ data: { error: 'falhou' }, error: null })
    await expect(reenviarEmailMontagem('m1')).rejects.toThrow('falhou')

    invoke.mockResolvedValueOnce({ data: {}, error: null })
    await expect(reenviarEmailMontagem('m1')).rejects.toThrow(/reenviar/)

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'invoke',
        context: { json: async () => ({ error: 'corpo' }) },
      },
    })
    await expect(reenviarEmailMontagem('m1')).rejects.toThrow('corpo')

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'invoke',
        context: { json: async () => ({}) },
      },
    })
    await expect(reenviarEmailMontagem('m1')).rejects.toThrow('invoke')

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'invoke',
        context: { json: async () => { throw new Error('json') } },
      },
    })
    await expect(reenviarEmailMontagem('m1')).rejects.toThrow('json')

    invoke.mockResolvedValueOnce({
      data: null,
      error: { message: '', context: { json: async () => { throw new Error('') } } },
    })
    await expect(reenviarEmailMontagem('m1')).rejects.toThrow(/reenviar/)
  })
})

describe('envio da montagem', () => {
  it('envia e traduz erros', async () => {
    const { enviarMontagemParaAdmin } = await import('./enviarMontagem')
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null })
    await enviarMontagemParaAdmin({
      slug: 'loja',
      visitante: {
        nome: 'Ana',
        email: '',
        whatsapp: '5511',
        endereco: '',
        cidade: '',
        estado: '',
      },
      itens: [],
      linkMontagem: 'https://exemplo.test',
      idempotencyKey: 'k1',
    })

    const randomUUID = crypto.randomUUID
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => 'uuid-gerado')
    invoke.mockResolvedValueOnce({ data: { error: 'negado' }, error: null })
    await expect(
      enviarMontagemParaAdmin({
        slug: 'loja',
        visitante: {
          nome: 'Ana',
          email: '',
          whatsapp: '1',
          endereco: '',
          cidade: '',
          estado: '',
        },
        itens: [],
        linkMontagem: 'https://exemplo.test',
      }),
    ).rejects.toThrow('negado')
    crypto.randomUUID = randomUUID

    invoke.mockResolvedValueOnce({ data: { ok: false }, error: null })
    await expect(
      enviarMontagemParaAdmin({
        slug: 'loja',
        visitante: {
          nome: 'Ana',
          email: '',
          whatsapp: '1',
          endereco: '',
          cidade: '',
          estado: '',
        },
        itens: [],
        linkMontagem: 'https://exemplo.test',
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/não foi possível enviar/i)

    invoke.mockResolvedValueOnce({
      data: { error: 'do data' },
      error: { message: 'invoke' },
    })
    await expect(
      enviarMontagemParaAdmin({
        slug: 'loja',
        visitante: {
          nome: 'Ana',
          email: '',
          whatsapp: '1',
          endereco: '',
          cidade: '',
          estado: '',
        },
        itens: [],
        linkMontagem: 'https://exemplo.test',
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow('do data')

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'invoke',
        context: { json: async () => ({ error: 'do corpo' }) },
      },
    })
    await expect(
      enviarMontagemParaAdmin({
        slug: 'loja',
        visitante: {
          nome: 'Ana',
          email: '',
          whatsapp: '1',
          endereco: '',
          cidade: '',
          estado: '',
        },
        itens: [],
        linkMontagem: 'https://exemplo.test',
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow('do corpo')

    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: '',
        context: { json: async () => { throw new Error('ruim') } },
      },
    })
    await expect(
      enviarMontagemParaAdmin({
        slug: 'loja',
        visitante: {
          nome: 'Ana',
          email: '',
          whatsapp: '1',
          endereco: '',
          cidade: '',
          estado: '',
        },
        itens: [],
        linkMontagem: 'https://exemplo.test',
        idempotencyKey: 'k',
      }),
    ).rejects.toThrow(/não foi possível enviar/i)
  })
})
