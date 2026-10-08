import { describe, expect, it, vi } from 'vitest'
import {
  aplicarIdentidadeLoja,
  ehHexCor,
  limparIdentidadeLoja,
  normalizarHexCor,
  varsIdentidadeLoja,
} from '../compartilhado/identidadeLoja'
import { aplicarMetaLoja, limparMetaLoja } from '../compartilhado/metaLoja'
import { capturarErro, rastrear } from '../compartilhado/observabilidade'
import {
  diasRestantesPastDue,
  diasRestantesTrial,
  imagemCatalogoItem,
  imagemMesaItem,
} from '../compartilhado/tipos'
import {
  dimensoesVisuaisGuardanapo,
  estiloCamadaDimensionada,
  formatarDimensoes,
  inferirDimensoes,
  itemRedondo,
  temDimensoes,
} from '../compartilhado/utils/dimensoes'
import { ehSlugReservado, gerarSlug } from '../dados/slug'
import {
  digitosWhatsappNacional,
  formatarWhatsapp,
  normalizarWhatsapp,
} from '../dados/whatsapp'
import { CadastroErro, CadastroPendenteConfirmacao, EntrarErro } from '../dados/erros'
import {
  ehCategoriaFixa,
  extrairDadosCliente,
  mesclarToalhasFixas,
} from '../dados/categoriasFixas'
import {
  gravarFlagRecoveryLocal,
  lerFlagRecoveryLocal,
  metadataMarcaRecovery,
} from '../dados/authRecovery'
import {
  destinoPosLogin,
  mapearErroCadastro,
  mapearErroUpload,
  nomeExibicaoPendente,
  validarSenhasIguais,
} from '../funcionalidades/admin/adminUtils'
import { UploadErro } from '../dados/storage'
import { baixarCsv, fimDoDiaLocal, leadNovoParado } from '../funcionalidades/admin/csvMontagens'
import {
  montarTextoMontagem,
  textoContatoLead,
  urlWhatsAppMontagem,
} from '../funcionalidades/mesa/mensagemMontagem'
import {
  chaveCamada,
  ehCodigoCamadaConhecido,
  ordenarCategoriasPorCamada,
  pesoCamada,
} from '../funcionalidades/mesa/ordemCamadas'
import {
  dimensoesGuardanapoVisual,
  meiaLarguraTalherPct,
  origemPxDePosicao,
  posicionarTalheres,
} from '../funcionalidades/mesa/layoutEtiqueta'
import {
  aplicarSelecao,
  criarConfiguracaoVazia,
  ehCategoriaMulti,
  idsSelecionados,
  obterItemPorId,
  obterItensPorCategoria,
  obterItensPorIds,
  temSelecaoNaCategoria,
} from '../funcionalidades/catalogo/catalogo'
import {
  configuracaoDeItensEnviados,
  linkAbrirMontagemAdmin,
  temSelecao,
  urlComMontagem,
} from '../funcionalidades/mesa/montagemUrl'
import type { Categoria, ItemMesa } from '../compartilhado/tipos'
import * as classes from '../funcionalidades/admin/adminClasses'
import { OPCOES_CODIGO_CATEGORIA } from '../funcionalidades/admin/opcoesCodigoCategoria'
import * as catalogoIndex from '../funcionalidades/catalogo'

describe('identidade, meta e observabilidade', () => {
  it('normaliza cores e aplica vars', () => {
    expect(ehHexCor(' #AABBCC ')).toBe(true)
    expect(normalizarHexCor(null)).toBe('')
    expect(normalizarHexCor('zz')).toBe('')
    expect(normalizarHexCor('AABBCC')).toBe('#aabbcc')
    const claras = varsIdentidadeLoja('#eeeeee', '#f5f5f5')
    expect(claras['--on-accent']).toBe('#1a2421')
    expect(claras['--text']).toBe('#1a2421')
    const escuras = varsIdentidadeLoja('#112233', '#101010')
    expect(escuras['--on-accent']).toBe('#ffffff')
    expect(escuras['--text']).toBe('#f5f7f6')
    expect(varsIdentidadeLoja('', '')).toEqual({})

    const alvo = document.createElement('div')
    aplicarIdentidadeLoja('#112233', '', alvo)
    expect(alvo.style.getPropertyValue('--accent')).toBe('#112233')
    expect(alvo.style.getPropertyValue('--bg')).toBe('')
    limparIdentidadeLoja(alvo)
    expect(alvo.style.getPropertyValue('--accent')).toBe('')
    aplicarIdentidadeLoja('', '')
    limparIdentidadeLoja()
  })

  it('define meta da loja e rastreia o funil', () => {
    aplicarMetaLoja({
      nome: '  ',
      descricao: 'Desc',
      url: 'https://exemplo.test/loja',
      imagem: 'https://exemplo.test/og.png',
    })
    expect(document.title).toContain('Montagem de Mesa')
    aplicarMetaLoja({
      nome: 'Loja',
      descricao: 'Outra',
      url: 'https://exemplo.test/loja',
    })
    expect(document.title).toContain('Loja')
    limparMetaLoja()

    const sentry = {
      addBreadcrumb: vi.fn(),
      captureException: vi.fn(),
    }
    window.Sentry = sentry
    for (let i = 0; i < 42; i += 1) rastrear('item_selected', { i })
    expect(window.__montagemObs?.eventos.length).toBeLessThanOrEqual(40)
    expect(sentry.addBreadcrumb).toHaveBeenCalled()
    capturarErro(new Error('x'), 'envio')
    capturarErro('falha')
    expect(sentry.captureException).toHaveBeenCalled()
  })
})

describe('tipos, dimensões e catálogo', () => {
  const item = (parcial: Partial<ItemMesa> & Pick<ItemMesa, 'id' | 'nome'>): ItemMesa => ({
    categoria: 'pratoRaso',
    cores: { primaria: '#fff' },
    ...parcial,
  })

  it('escolhe imagem e calcula dias', () => {
    expect(imagemCatalogoItem({ imagemCatalogo: 'c', imagem: 'm' })).toBe('c')
    expect(imagemCatalogoItem({ imagem: 'm' })).toBe('m')
    expect(imagemMesaItem({ imagem: 'm', imagemCatalogo: 'c' })).toBe('m')
    expect(imagemMesaItem({ imagemCatalogo: 'c' })).toBe('c')
    expect(
      diasRestantesTrial({ subscriptionStatus: 'active', trialEndsAt: '2099-01-01' }),
    ).toBeNull()
    expect(
      diasRestantesTrial(
        { subscriptionStatus: 'trialing', trialEndsAt: '2000-01-01T00:00:00.000Z' },
        Date.parse('2026-01-01'),
      ),
    ).toBe(0)
    expect(
      diasRestantesPastDue({ subscriptionStatus: 'active', currentPeriodEnd: '2099-01-01' }),
    ).toBeNull()
    expect(
      diasRestantesPastDue(
        { subscriptionStatus: 'past_due', currentPeriodEnd: '2000-01-01T00:00:00.000Z' },
        Date.parse('2026-01-01'),
      ),
    ).toBe(0)
  })

  it('infere dimensões e formata', () => {
    expect(inferirDimensoes('Caixa 10 x 20 x 30 cm', 'x')).toEqual({
      largura: 10,
      comprimento: 30,
    })
    expect(inferirDimensoes('Talher 20 x 4 cm', 'talher')).toEqual({
      largura: 4,
      comprimento: 20,
    })
    expect(inferirDimensoes('Colher de sobremesa 18 x 3 cm', 'talher').comprimento).toBe(16)
    expect(inferirDimensoes('Ret 12,5 x 8 cm', 'lugarAmericano').largura).toBe(12.5)
    expect(inferirDimensoes('Prato 27 cm', 'pratoRaso')).toEqual({
      largura: 27,
      comprimento: 27,
    })
    expect(inferirDimensoes('Colher de café', 'talher')).toEqual({
      largura: 2.5,
      comprimento: 16,
    })
    expect(inferirDimensoes('Sousplat redondo', 'sousplat').largura).toBe(36)
    expect(inferirDimensoes('Peça redonda', 'outro').largura).toBe(30)
    expect(inferirDimensoes('Base MDF especial', 'sousplat')).toEqual({
      largura: 30,
      comprimento: 30,
    })
    expect(inferirDimensoes('Mini sousplat', 'sousplat').largura).toBe(26)
    expect(inferirDimensoes('Padrão', 'desconhecida').largura).toBe(30)
    expect(inferirDimensoes('Padrão', 'pratoFundo').largura).toBe(27)

    const redondo = item({ id: '1', nome: 'Prato', largura: 27, comprimento: 27 })
    const oval = item({ id: '2', nome: 'Americano redondo', largura: 40, comprimento: 30 })
    expect(temDimensoes(item({ id: '3', nome: 's' }))).toBe(false)
    expect(itemRedondo(redondo)).toBe(true)
    expect(itemRedondo(oval)).toBe(true)
    expect(formatarDimensoes(redondo)).toContain('Ø')
    expect(formatarDimensoes(item({ id: '4', nome: 'x', largura: 10.5, comprimento: 20 }))).toContain(
      '10,5',
    )
    expect(
      (estiloCamadaDimensionada(redondo) as { '--item-largura': number })['--item-largura'],
    ).toBe(27)
    expect(dimensoesVisuaisGuardanapo(redondo, 20).largura).toBeGreaterThan(0)
    expect(catalogoIndex.criarConfiguracaoVazia).toBeTypeOf('function')
  })

  it('seleciona itens', () => {
    const categorias: Categoria[] = [
      { id: 'talher', codigo: 'talher', rotulo: 'Talheres', descricao: '' },
      { id: 'outro', rotulo: 'Outro', descricao: '' },
    ]
    const itens = [
      item({ id: 'a', nome: 'Garfo', categoria: 'talher' }),
      item({ id: '', nome: 'Vazio', categoria: 'talher' }),
    ]
    expect(ehCategoriaMulti(categorias[0]!)).toBe(true)
    expect(ehCategoriaMulti(categorias[1]!)).toBe(false)
    expect(idsSelecionados(['a', ''])).toEqual(['a'])
    expect(idsSelecionados('')).toEqual([])
    expect(temSelecaoNaCategoria(null)).toBe(false)
    expect(criarConfiguracaoVazia(categorias)).toEqual({ talher: null, outro: null })
    expect(obterItemPorId(itens, null)).toBeNull()
    expect(obterItemPorId(itens, 'z')).toBeNull()
    expect(obterItensPorIds(itens, ['a', 'z'])).toHaveLength(1)
    expect(obterItensPorCategoria(itens, 'talher')).toHaveLength(2)
    expect(aplicarSelecao('a', null, false)).toBeNull()
    expect(aplicarSelecao(['a'], 'a', true)).toBeNull()
  })
})

describe('slug, whatsapp, erros e admin', () => {
  it('cobre helpers', () => {
    expect(gerarSlug('Açúcar  Loja!!')).toBe('acucar-loja')
    expect(gerarSlug('a__b--c')).toBe('a_b-c')
    expect(ehSlugReservado('admin')).toBe(true)
    expect(ehSlugReservado('loja')).toBe(false)

    expect(digitosWhatsappNacional('')).toBe('')
    expect(digitosWhatsappNacional('5511999999999888')).toHaveLength(11)
    expect(formatarWhatsapp('')).toBe('')
    expect(formatarWhatsapp('11')).toBe('(11')
    expect(formatarWhatsapp('119999')).toBe('(11) 9999')
    expect(formatarWhatsapp('1199998888')).toContain('-')
    expect(formatarWhatsapp('11999998888')).toBe('(11) 99999-8888')
    expect(normalizarWhatsapp('')).toBe('')
    expect(normalizarWhatsapp('(11) 99999-8888')).toBe('5511999998888')

    expect(new EntrarErro('x', 'credenciais').name).toBe('EntrarErro')
    expect(new CadastroErro('x').name).toBe('CadastroErro')
    expect(new CadastroPendenteConfirmacao().name).toBe('CadastroPendenteConfirmacao')

    expect(ehCategoriaFixa('toalha')).toBe(true)
    const dados = mesclarToalhasFixas({
      nome: 'L',
      logo: '',
      corMarca: '',
      corFundo: '',
      categorias: [{ id: 'toalha', rotulo: 'T', descricao: '' }, { id: 'x', rotulo: 'X', descricao: '' }],
      itens: [],
    })
    expect(extrairDadosCliente(dados).categorias.some((c) => c.id === 'toalha')).toBe(false)

    expect(metadataMarcaRecovery(null)).toBe(false)
    expect(metadataMarcaRecovery({ precisa_redefinir_senha: true })).toBe(true)
    gravarFlagRecoveryLocal(true)
    expect(lerFlagRecoveryLocal()).toBe(true)
    gravarFlagRecoveryLocal(false)
    expect(lerFlagRecoveryLocal()).toBe(false)
    vi.spyOn(localStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('bloqueado')
    })
    expect(lerFlagRecoveryLocal()).toBe(false)
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('bloqueado')
    })
    gravarFlagRecoveryLocal(true)
    vi.spyOn(localStorage, 'removeItem').mockImplementationOnce(() => {
      throw new Error('bloqueado')
    })
    gravarFlagRecoveryLocal(false)

    expect(nomeExibicaoPendente({ nome: ' ', email: 'a@b.co' })).toBe(true)
    expect(nomeExibicaoPendente({ nome: 'contato', email: 'contato@loja.com' })).toBe(true)
    expect(nomeExibicaoPendente({ nome: 'Loja', email: 'contato@loja.com' })).toBe(false)
    expect(nomeExibicaoPendente({ nome: 'Loja', email: '' })).toBe(false)
    expect(destinoPosLogin('/admin/painel/x', { temAcesso: false })).toBe('/admin/assinatura')
    expect(destinoPosLogin(1)).toBe('/admin/painel')
    expect(destinoPosLogin('/admin')).toBe('/admin/painel')
    expect(destinoPosLogin('/admin/../etc')).toBe('/admin/painel')
    expect(destinoPosLogin('/admin//x')).toBe('/admin/painel')
    expect(destinoPosLogin('/admin/\\x')).toBe('/admin/painel')
    expect(destinoPosLogin('/fora')).toBe('/admin/painel')
    expect(destinoPosLogin('/admin/painel/cadastro')).toBe('/admin/painel/cadastro')
    expect(validarSenhasIguais('a', 'b')).toMatch(/não coincidem/)
    expect(validarSenhasIguais('a', '')).toBeNull()
    expect(mapearErroCadastro(new CadastroErro('msg'))).toBe('msg')
    expect(mapearErroCadastro(new Error('x'))).toMatch(/Tente novamente/)
    expect(mapearErroUpload(new UploadErro('up'))).toBe('up')
    expect(mapearErroUpload(new CadastroErro('c'))).toBe('c')
    expect(mapearErroUpload(new Error('x'), 'fb')).toBe('fb')

    expect(leadNovoParado('novo', 'nao-data')).toBe(false)
    expect(fimDoDiaLocal('2026-13-40')).toBeUndefined()
    const click = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
    baixarCsv('a,b', 'leads.csv')
    expect(click).toHaveBeenCalled()

    expect(Object.keys(classes).length).toBeGreaterThan(10)
    expect(OPCOES_CODIGO_CATEGORIA.some((o) => o.valor === 'talher')).toBe(true)
  })
})

describe('mensagem, camadas e url', () => {
  const categorias: Categoria[] = [
    { id: 'prato', codigo: 'pratoRaso', rotulo: 'Pratos', descricao: '' },
    { id: 'talher', codigo: null, rotulo: 'Talheres', descricao: '' },
    { id: 'extra', rotulo: 'Extra', descricao: '' },
  ]
  const itens: ItemMesa[] = [
    {
      id: 'p1',
      nome: 'Raso',
      categoria: 'prato',
      cores: { primaria: '#fff' },
    },
  ]

  it('monta textos e ordena camadas', () => {
    const texto = montarTextoMontagem({
      visitante: {
        nome: 'Ana',
        email: 'a@b.co',
        whatsapp: '5511',
        endereco: 'Rua',
        cidade: 'SP',
        estado: 'SP',
      },
      itens: [{ categoria: 'Prato', nome: 'Raso' }],
      linkMontagem: 'https://exemplo.test',
      nomeEstabelecimento: 'Loja',
    })
    expect(texto).toContain('Nova montagem — Loja')
    expect(texto).toContain('E-mail:')
    const vazio = montarTextoMontagem({
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
    })
    expect(vazio).toContain('(nenhum item)')
    expect(
      textoContatoLead({
        nomeLoja: 'Loja',
        visitanteNome: 'Ana',
        itens: [],
        linkMontagem: '',
      }),
    ).toContain('nenhum item')
    expect(
      textoContatoLead({
        nomeLoja: 'Loja',
        visitanteNome: 'Ana',
        itens: [{ categoria: 'Prato', nome: 'Raso' }],
        linkMontagem: 'https://exemplo.test',
      }),
    ).toContain('Link:')
    expect(urlWhatsAppMontagem('+55 (11) 9', 'olá')).toContain('wa.me/55119')

    expect(ehCodigoCamadaConhecido('toalha')).toBe(true)
    expect(ehCodigoCamadaConhecido('outro')).toBe(false)
    expect(chaveCamada({ id: 'x', codigo: null })).toBe('x')
    expect(pesoCamada('desconhecido')).toBeGreaterThan(pesoCamada('taca'))
    const ordem = ordenarCategoriasPorCamada(categorias)
    expect(ordem[0]?.codigo).toBe('pratoRaso')

    expect(dimensoesGuardanapoVisual().comprimento).toBeGreaterThan(0)
    expect(meiaLarguraTalherPct(3)).toBeGreaterThan(0)
    expect(
      origemPxDePosicao(
        { leftPct: 10, topPct: 20, rotateDeg: 0, ancora: 'topoEsquerdo', zIndex: 1 },
        10,
        10,
        0,
        0,
        100,
      ).x,
    ).toBe(10)
    expect(
      posicionarTalheres([
        {
          id: 'o',
          nome: 'Espátula',
          categoria: 'talher',
          cores: { primaria: '#000' },
        },
      ]).some((p) => p.tipo === 'outro'),
    ).toBe(true)

    expect(temSelecao({ a: null })).toBe(false)
    expect(urlComMontagem('/loja', { a: null })).toBe('/loja')
    const config = configuracaoDeItensEnviados(
      [
        { categoria: ' ', nome: 'Raso' },
        { categoria: 'Pratos', nome: 'Raso' },
        { categoria: 'Inexistente', nome: 'X' },
        { categoria: 'Pratos', nome: 'Fantasma' },
      ],
      categorias,
      itens,
    )
    expect(config.prato).toBe('p1')

    const aberto = linkAbrirMontagemAdmin({
      slug: 'loja',
      linkSalvo: 'https://exemplo.test/loja?m=prato:p1',
      itensEnviados: [],
      categorias,
      itensCatalogo: itens,
    })
    expect(aberto).toContain('m=')
    const sem = linkAbrirMontagemAdmin({
      slug: 'loja',
      linkSalvo: 'nao-e-url',
      itensEnviados: [{ categoria: 'Nada', nome: 'Nada' }],
      categorias,
      itensCatalogo: itens,
    })
    expect(sem.endsWith('/loja')).toBe(true)
  })
})
