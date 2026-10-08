import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CadastroErro, CadastroPendenteConfirmacao, EntrarErro } from './erros'

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

const linhaCliente = {
  id: CLIENTE_ID,
  slug: 'loja',
  email: 'loja@teste.com',
  nome: 'Loja',
  logo: `${CLIENTE_ID}.webp`,
  whatsapp: '5511999999999',
  cor_marca: '#112233',
  cor_fundo: '#eef1ef',
  subscription_status: 'estranho',
  trial_ends_at: null,
  current_period_end: '2099-01-01T00:00:00.000Z',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  updated_at: null,
}

function fila(resultados: Array<Parameters<typeof consulta>[0]>) {
  const pendentes = [...resultados]
  from.mockImplementation(() => consulta(pendentes.shift() ?? { data: null }))
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.signOut.mockResolvedValue({ error: null })
  auth.updateUser.mockResolvedValue({ data: { user: null }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
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

describe('clientes', () => {
  it('mapeia e carrega cliente, catálogo e cadastro', async () => {
    const repo = await import('./repositorioClientes')

    fila([{ data: linhaCliente, error: null }])
    const proprio = await repo.obterClientePorId(CLIENTE_ID)
    expect(proprio?.subscriptionStatus).toBe('trialing')
    expect(proprio?.whatsapp).toBe('5511999999999')

    fila([{ data: null, error: { message: 'rls' } }])
    rpc.mockResolvedValueOnce({
      data: [{ id: CLIENTE_ID, slug: 'loja', nome: 'Loja', logo: '' }],
      error: null,
    })
    const publico = await repo.obterClientePorId(CLIENTE_ID)
    expect(publico?.email).toBe('')

    fila([{ data: null, error: { message: 'rls' } }])
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await repo.obterClientePorId(CLIENTE_ID)).toBeNull()

    rpc.mockResolvedValueOnce({ error: { message: 'publico' } })
    await expect(repo.obterClientePorId(CLIENTE_ID)).rejects.toMatchObject({
      message: 'publico',
    })

    rpc.mockResolvedValueOnce({
      data: { id: CLIENTE_ID, slug: 'loja', nome: 'Loja', logo: '', whatsapp: '55' },
      error: null,
    })
    expect((await repo.obterClientePorSlug('loja'))?.nome).toBe('Loja')

    rpc.mockResolvedValueOnce({ data: [], error: null })
    expect(await repo.obterClientePorSlug('loja')).toBeNull()

    rpc.mockResolvedValueOnce({
      data: [{ existe: true, tem_acesso: false, nome: 'Loja' }],
      error: null,
    })
    expect(await repo.statusClientePublico('loja')).toEqual({
      existe: true,
      temAcesso: false,
      nome: 'Loja',
    })
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect((await repo.statusClientePublico('x')).existe).toBe(false)
    rpc.mockResolvedValueOnce({
      data: { existe: 1, tem_acesso: 1, nome: 12 },
      error: null,
    })
    expect((await repo.statusClientePublico('x')).nome).toBeNull()
    rpc.mockResolvedValueOnce({ error: { message: 'status' } })
    await expect(repo.statusClientePublico('x')).rejects.toMatchObject({
      message: 'status',
    })

    fila([{ data: linhaCliente, error: null }])
    expect((await repo.obterClientePorAuthUserId('u'))?.id).toBe(CLIENTE_ID)
    fila([{ data: null, error: null }])
    expect(await repo.obterClientePorAuthUserId('u')).toBeNull()
    fila([{ error: { message: 'auth id' } }])
    await expect(repo.obterClientePorAuthUserId('u')).rejects.toMatchObject({
      message: 'auth id',
    })

    fila([{ data: null, error: { message: 'sem' } }])
    rpc.mockResolvedValueOnce({ data: null, error: null })
    expect(await repo.carregarDadosCliente(CLIENTE_ID)).toBeNull()

    fila([
      { data: { ...linhaCliente, logo: '' }, error: null },
      {
        data: [
          {
            id: CATEGORIA_ID,
            codigo: 'pratoRaso',
            rotulo: 'Prato',
            descricao: 'd',
            ordem: 1,
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: ITEM_ID,
            categoria_id: CATEGORIA_ID,
            nome: 'Branco',
            imagem: `${CLIENTE_ID}/${CATEGORIA_ID}/${ITEM_ID}.webp`,
            imagem_catalogo: `${CLIENTE_ID}/${CATEGORIA_ID}/${ITEM_ID}-catalogo.webp`,
            cores: { primaria: '#fff' },
            largura: 27,
            comprimento: null,
            padrao: 'solid',
            descricao: 'liso',
            ordem: 1,
          },
        ],
        error: null,
      },
    ])
    const dados = await repo.carregarDadosCliente(CLIENTE_ID)
    expect(dados?.itens.some((i) => i.id === ITEM_ID)).toBe(true)
    expect(dados?.categorias.some((c) => c.id === 'toalha')).toBe(true)

    fila([
      { data: linhaCliente, error: null },
      { error: { message: 'cats' } },
      { data: [], error: null },
    ])
    await expect(repo.carregarDadosCliente(CLIENTE_ID)).rejects.toMatchObject({
      message: 'cats',
    })

    fila([
      { data: linhaCliente, error: null },
      { data: [], error: null },
      { error: { message: 'itens' } },
    ])
    await expect(repo.carregarDadosCliente(CLIENTE_ID)).rejects.toMatchObject({
      message: 'itens',
    })

    rpc.mockResolvedValueOnce({ error: { message: 'cat pub' } })
    await expect(repo.carregarCatalogoPublico('loja')).rejects.toMatchObject({
      message: 'cat pub',
    })

    rpc.mockResolvedValueOnce({ data: { existe: false }, error: null })
    expect((await repo.carregarCatalogoPublico('loja')).existe).toBe(false)

    rpc.mockResolvedValueOnce({
      data: { existe: true, tem_acesso: false, nome: 'Loja', cliente: { id: CLIENTE_ID } },
      error: null,
    })
    expect((await repo.carregarCatalogoPublico('loja')).temAcesso).toBe(false)

    rpc.mockResolvedValueOnce({
      data: { existe: true, tem_acesso: true, nome: 1, cliente: {} },
      error: null,
    })
    expect((await repo.carregarCatalogoPublico('loja')).clienteId).toBeNull()

    rpc.mockResolvedValueOnce({
      data: {
        existe: true,
        tem_acesso: true,
        nome: 'Loja',
        cliente: {
          id: CLIENTE_ID,
          nome: 'Loja',
          logo: `${CLIENTE_ID}.webp`,
          whatsapp: '5511',
          cor_marca: '#112233',
          cor_fundo: '#ffffff',
        },
        categorias: [
          { id: CATEGORIA_ID, rotulo: 'Prato', descricao: 'd' },
        ],
        itens: [
          {
            id: ITEM_ID,
            categoria_id: CATEGORIA_ID,
            nome: 'Branco',
            cores: { primaria: '#fff' },
          },
        ],
      },
      error: null,
    })
    const catalogo = await repo.carregarCatalogoPublico('loja')
    expect(catalogo.dados?.nome).toBe('Loja')
    expect(catalogo.email).toBe('')

    const semMidia = await repo.renovarUrlsAssinadas({
      nome: 'Loja',
      logo: '',
      corMarca: '',
      corFundo: '',
      categorias: [],
      itens: [{ id: 'i', nome: 'n', categoria: 'c', cores: { primaria: '#000' } }],
    })
    expect(semMidia.logo).toBe('')

    storageFrom.mockImplementationOnce(() => ({
      createSignedUrls: vi.fn(async () => ({ data: null, error: { message: 'sign' } })),
    }))
    const intacto = await repo.renovarUrlsAssinadas({
      nome: 'Loja',
      logo: `${CLIENTE_ID}.webp`,
      corMarca: '',
      corFundo: '',
      categorias: [],
      itens: [],
    })
    expect(intacto.logo).toBe(`${CLIENTE_ID}.webp`)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    expect(await repo.enderecoMontagemEmUso('   ')).toBe(false)
    rpc.mockResolvedValueOnce({ data: true, error: null })
    expect(await repo.enderecoMontagemEmUso('Minha Loja', CLIENTE_ID)).toBe(true)
    rpc.mockResolvedValueOnce({ error: { message: 'slug' } })
    await expect(repo.enderecoMontagemEmUso('loja', CLIENTE_ID)).rejects.toMatchObject({
      message: 'slug',
    })
    rpc.mockResolvedValueOnce({ data: false, error: null })
    expect(await repo.enderecoMontagemEmUso('outra')).toBe(false)
    rpc.mockResolvedValueOnce({ error: { message: 'uso' } })
    await expect(repo.enderecoMontagemEmUso('outra')).rejects.toMatchObject({
      message: 'uso',
    })

    await expect(
      repo.atualizarCadastro(CLIENTE_ID, { nome: ' ', slug: 'loja', logo: '' }),
    ).rejects.toBeInstanceOf(CadastroErro)
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, { nome: 'Loja', slug: ' ', logo: '' }),
    ).rejects.toThrow(/endereço/)
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, {
        nome: 'Loja',
        slug: 'loja',
        logo: '',
        whatsapp: '11',
      }),
    ).rejects.toThrow(/WhatsApp/)
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, {
        nome: 'Loja',
        slug: 'loja',
        logo: '',
        corMarca: 'vermelho',
      }),
    ).rejects.toThrow(/destaque/)
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, {
        nome: 'Loja',
        slug: 'loja',
        logo: '',
        corFundo: 'azul',
      }),
    ).rejects.toThrow(/fundo/)
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, { nome: 'Loja', slug: 'admin', logo: '' }),
    ).rejects.toThrow(/reservado/)

    rpc.mockResolvedValueOnce({ data: true, error: null })
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, { nome: 'Loja', slug: 'loja', logo: '' }),
    ).rejects.toThrow(/em uso/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    fila([{ data: linhaCliente, error: null }])
    const salvo = await repo.atualizarCadastro(CLIENTE_ID, {
      nome: 'Loja',
      slug: 'loja',
      logo: '',
      whatsapp: '',
      corMarca: '#112233',
      corFundo: '',
    })
    expect(salvo.id).toBe(CLIENTE_ID)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    fila([{ data: null, error: { code: '23505', message: 'dup' } }])
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, { nome: 'Loja', slug: 'loja', logo: '' }),
    ).rejects.toThrow(/em uso/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    fila([{ data: null, error: { message: 'save' } }])
    await expect(
      repo.atualizarCadastro(CLIENTE_ID, { nome: 'Loja', slug: 'loja', logo: '' }),
    ).rejects.toThrow(/salvar o cadastro/)

    await expect(repo.solicitarTrocaEmail(CLIENTE_ID, '  ')).rejects.toThrow(/e-mail/)
    auth.getUser.mockResolvedValueOnce({
      data: { user: { new_email: 'novo@teste.com' } },
      error: null,
    })
    await repo.solicitarTrocaEmail(CLIENTE_ID, 'novo@teste.com')
    expect(auth.updateUser).not.toHaveBeenCalled()

    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    auth.updateUser.mockResolvedValueOnce({ error: null })
    await repo.solicitarTrocaEmail(CLIENTE_ID, 'novo@teste.com', { forcarReenvio: true })
    expect(auth.updateUser).toHaveBeenCalled()

    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    auth.updateUser.mockResolvedValueOnce({
      error: { code: 'over_email_send_rate_limit', message: 'rate' },
    })
    await expect(repo.solicitarTrocaEmail(CLIENTE_ID, 'novo@teste.com')).rejects.toThrow(
      /Limite de e-mails/,
    )

    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    auth.updateUser.mockResolvedValueOnce({ error: { message: 'nope' } })
    await expect(repo.solicitarTrocaEmail(CLIENTE_ID, 'outro@teste.com')).rejects.toThrow(
      /troca de e-mail/,
    )

    fila([{ data: null, error: { message: 'x' } }])
    rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(
      repo.atualizarPerfil(CLIENTE_ID, { nome: 'Loja', logo: '' }),
    ).rejects.toThrow(/não encontrado/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    fila([
      { data: linhaCliente, error: null },
      { data: linhaCliente, error: null },
    ])
    await repo.atualizarPerfil(CLIENTE_ID, { nome: 'Loja Nova', logo: '' })
  })
})

describe('autenticação', () => {
  it('entra, cadastra e recupera senha', async () => {
    const repo = await import('./repositorioAuth')
    expect(repo.mensagemSenhaRecusada({ reasons: ['pwned'] })).toMatch(/vazamentos/)
    expect(repo.mensagemSenhaRecusada({ message: 'Password leaked' })).toMatch(/vazamentos/)
    expect(repo.mensagemSenhaRecusada({ message: 'compromised' })).toMatch(/vazamentos/)
    expect(repo.mensagemSenhaRecusada({ code: 'weak_password' })).toMatch(/forte/)
    expect(repo.mensagemSenhaRecusada({})).toBeNull()

    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'email_not_confirmed', message: 'x' },
    })
    await expect(repo.entrar(' Loja@teste.com ', 'senha123456')).rejects.toBeInstanceOf(
      EntrarErro,
    )

    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Email not confirmed' },
    })
    await expect(repo.entrar('loja@teste.com', 'senha123456')).rejects.toBeInstanceOf(
      EntrarErro,
    )

    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'invalid' },
    })
    expect(await repo.entrar('loja@teste.com', 'senha123456')).toBeNull()

    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'u', email: '', user_metadata: {} } },
      error: null,
    })
    fila([{ data: null, error: null }])
    await expect(repo.entrar('loja@teste.com', 'senha123456')).rejects.toMatchObject({
      codigo: 'conta_incompleta',
    })
    expect(auth.signOut).toHaveBeenCalled()

    auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u',
          email: 'loja@teste.com',
          user_metadata: { precisa_redefinir_senha: true },
        },
      },
      error: null,
    })
    fila([{ data: linhaCliente, error: null }])
    auth.updateUser.mockRejectedValueOnce(new Error('meta'))
    expect((await repo.entrar('loja@teste.com', 'senha123456'))?.id).toBe(CLIENTE_ID)

    auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u',
          email: 'outro@teste.com',
          user_metadata: {},
        },
      },
      error: null,
    })
    fila([{ data: linhaCliente, error: null }])
    rpc.mockResolvedValueOnce({ data: [linhaCliente], error: null })
    expect((await repo.entrar('outro@teste.com', 'senha123456'))?.email).toBe(
      'loja@teste.com',
    )

    auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: { id: 'u', email: 'outro@teste.com', user_metadata: {} },
      },
      error: null,
    })
    fila([{ data: linhaCliente, error: null }])
    rpc.mockResolvedValueOnce({ error: { message: 'sync' } })
    expect(await repo.entrar('outro@teste.com', 'senha123456')).not.toBeNull()

    await expect(
      repo.cadastrar({ nome: ' ', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/nome/)
    await expect(
      repo.cadastrar({ nome: 'Loja', email: ' ', senha: 'senha123456' }),
    ).rejects.toThrow(/e-mail/)
    await expect(
      repo.cadastrar({ nome: '!!!', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/endereço/)
    await expect(
      repo.cadastrar({ nome: 'admin', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/reservado/)
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'curta' }),
    ).rejects.toThrow(/10/)

    rpc.mockResolvedValueOnce({ error: { message: 'slug rpc' } })
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toMatchObject({ message: 'slug rpc' })

    rpc.mockResolvedValueOnce({ data: true, error: null })
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/em uso/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'known to be weak', reasons: [] },
    })
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/vazamentos/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'rate limit exceeded' },
    })
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/Não foi possível criar a conta/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    })
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/Não foi possível criar a conta/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'u', email: 'a@b.co' }, session: null },
      error: null,
    })
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toBeInstanceOf(CadastroPendenteConfirmacao)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    auth.signUp.mockResolvedValueOnce({
      data: {
        user: { id: 'u', email: '', user_metadata: {} },
        session: { access_token: 't' },
      },
      error: null,
    })
    fila([{ data: null, error: null }])
    await expect(
      repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }),
    ).rejects.toThrow(/salvar o cliente/)

    rpc.mockResolvedValueOnce({ data: false, error: null })
    auth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u',
          email: 'a@b.co',
          user_metadata: { nome: 'Loja', slug: 'loja' },
        },
        session: { access_token: 't' },
      },
      error: null,
    })
    fila([
      { data: null, error: null },
      { data: linhaCliente, error: null },
    ])
    expect(
      (await repo.cadastrar({ nome: 'Loja', email: 'a@b.co', senha: 'senha123456' }))?.id,
    ).toBe(CLIENTE_ID)

    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null })
    await repo.solicitarRedefinicaoSenha(' A@b.co ')
    auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: { code: 'over_email_send_rate_limit', message: 'x' },
    })
    await expect(repo.solicitarRedefinicaoSenha('a@b.co')).rejects.toThrow(/Limite/)
    auth.resetPasswordForEmail.mockResolvedValueOnce({
      error: { message: 'redirect not allowed' },
    })
    await expect(repo.solicitarRedefinicaoSenha('a@b.co')).rejects.toThrow(/redefinição/)
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'outro' } })
    await expect(repo.solicitarRedefinicaoSenha('a@b.co')).rejects.toThrow(/redefinição/)

    auth.resend.mockResolvedValueOnce({ error: null })
    await repo.reenviarEmailConfirmacao('a@b.co')
    auth.resend.mockResolvedValueOnce({ error: { message: 'rate limit' } })
    await expect(repo.reenviarEmailConfirmacao('a@b.co')).rejects.toThrow(/Limite/)
    auth.resend.mockResolvedValueOnce({ error: { message: 'falha' } })
    await expect(repo.reenviarEmailConfirmacao('a@b.co')).rejects.toThrow(/reenviar/)

    await expect(repo.atualizarSenha('curta')).rejects.toThrow(/10/)
    auth.updateUser.mockResolvedValueOnce({ error: { message: 'pwned password' } })
    await expect(repo.atualizarSenha('senha123456')).rejects.toThrow(/vazamentos/)
    auth.updateUser.mockResolvedValueOnce({ error: { message: 'falha' } })
    await expect(repo.atualizarSenha('senha123456')).rejects.toThrow(/atualizar a senha/)
    auth.updateUser.mockResolvedValueOnce({ error: null })
    await repo.atualizarSenha('senha123456')
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'others' })

    auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'u' } }, error: null })
    expect(await repo.obterSessaoAuthPresente()).toBe(true)
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'x' } })
    expect(await repo.obterSessaoAuthPresente()).toBe(false)

    auth.getUser.mockResolvedValueOnce({
      data: { user: { user_metadata: { precisa_redefinir_senha: true } } },
      error: null,
    })
    expect(await repo.sessaoExigeRedefinirSenha()).toBe(true)
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect(await repo.sessaoExigeRedefinirSenha()).toBe(false)

    await repo.sair()

    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    const desinscrever = vi.fn()
    let ouvinte: (evento: string, session: unknown) => void = () => {}
    auth.onAuthStateChange.mockImplementation((cb: typeof ouvinte) => {
      ouvinte = cb
      return { data: { subscription: { unsubscribe: desinscrever } } }
    })
    const eventos: boolean[] = []
    const parar = repo.ouvirSessaoAuth((tem) => eventos.push(tem))
    await vi.waitFor(() => expect(eventos.length).toBeGreaterThan(0))
    ouvinte('SIGNED_IN', { user: { id: 'u' } })
    ouvinte('SIGNED_OUT', null)
    parar()
    expect(desinscrever).toHaveBeenCalled()

    auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'u', email: 'loja@teste.com', user_metadata: {} } },
      error: null,
    })
    fila([{ data: linhaCliente, error: null }])
    expect((await repo.obterSessaoCliente())?.id).toBe(CLIENTE_ID)
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })
    expect(await repo.obterSessaoCliente()).toBeNull()
  })

  it('ouve sessão com recovery, corrida e falha ao mapear', async () => {
    const { ouvirSessao } = await import('./repositorioAuth')
    const chamadas: unknown[] = []
    let ouvinte: (evento: string, session: unknown) => void = () => {}
    const desinscrever = vi.fn()
    auth.onAuthStateChange.mockImplementation((cb: typeof ouvinte) => {
      ouvinte = cb
      return { data: { subscription: { unsubscribe: desinscrever } } }
    })
    const parar = ouvirSessao((cliente, meta) => chamadas.push({ cliente, meta }))

    ouvinte('SIGNED_OUT', null)
    await vi.waitFor(() => expect(chamadas.length).toBeGreaterThan(0))

    auth.updateUser.mockResolvedValueOnce({ error: null })
    ouvinte('PASSWORD_RECOVERY', {
      user: { id: 'u', email: 'loja@teste.com', user_metadata: {} },
    })
    await vi.waitFor(() => expect(auth.updateUser).toHaveBeenCalled())

    auth.updateUser.mockRejectedValueOnce(new Error('meta'))
    ouvinte('PASSWORD_RECOVERY', {
      user: {
        id: 'u',
        email: 'loja@teste.com',
        user_metadata: { precisa_redefinir_senha: true },
      },
    })

    fila([{ error: { message: 'boom' } }])
    ouvinte('SIGNED_IN', {
      user: { id: 'u', email: 'loja@teste.com', user_metadata: {} },
    })
    await vi.waitFor(() =>
      expect(chamadas.some((c) => (c as { meta?: { sessaoValida?: boolean } }).meta?.sessaoValida)).toBe(
        true,
      ),
    )

    fila([{ data: linhaCliente, error: null }])
    ouvinte('SIGNED_IN', {
      user: { id: 'u', email: 'loja@teste.com', user_metadata: {} },
    })
    ouvinte('SIGNED_OUT', null)
    await vi.waitFor(() => expect(chamadas.length).toBeGreaterThan(2))

    parar()
    expect(desinscrever).toHaveBeenCalled()
  })

  it('cria cliente quando o auth ainda não tem linha', async () => {
    const { entrar } = await import('./repositorioAuth')
    auth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u',
          email: 'nova@teste.com',
          user_metadata: { nome: 'Nova Loja', slug: 'admin' },
        },
      },
      error: null,
    })
    fila([
      { data: null, error: null },
      { data: null, error: { code: '23505', message: 'dup' } },
      { data: linhaCliente, error: null },
      { data: linhaCliente, error: null },
    ])
    const cliente = await entrar('nova@teste.com', 'senha123456')
    expect(cliente?.id).toBe(CLIENTE_ID)
  })
})
