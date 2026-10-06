/**
 * Catálogo do Raffiner a partir de imagens/itens/raffiner.
 * Nome = arquivo sem medida e sem prefixo da categoria; dims em largura/comprimento.
 * Frontal → imagem_catalogo; demais → imagem (mesa).
 */
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import slugify from 'slugify'
import { EXTS_IMAGEM } from './imagem-mime.mjs'

export const CATEGORIAS = [
  {
    pasta: 'Lugar Americano',
    id: 'lugarAmericano',
    rotulo: 'Lugares Americanos',
    descricao: 'Base do lugar, sob o sousplat',
    prefixos: ['Lugar Americano'],
  },
  {
    pasta: 'Sousplat',
    id: 'sousplat',
    rotulo: 'Sousplats',
    descricao: 'Base do lugar à mesa',
    prefixos: ['Mini Sousplat', 'Sousplat'],
  },
  {
    pasta: 'Pratos Rasos',
    id: 'pratoRaso',
    rotulo: 'Pratos Rasos',
    descricao: 'Pratos rasos para o centro do lugar',
    prefixos: ['Prato Raso'],
  },
  {
    pasta: 'Pratos Fundos',
    id: 'pratoFundo',
    rotulo: 'Pratos Fundos',
    descricao: 'Pratos fundos e especiais sobre o prato raso',
    prefixos: ['Prato Fundo'],
  },
  {
    pasta: 'Pratos de sobremesa',
    id: 'pratoSobremesa',
    rotulo: 'Pratos de Sobremesa',
    descricao: 'Pratos de sobremesa sobre o lugar',
    prefixos: ['Prato de Sobremesa'],
  },
  {
    pasta: 'Guardanapos',
    id: 'guardanapo',
    rotulo: 'Guardanapos',
    descricao: 'Guardanapos de tecido sobre o prato',
    prefixos: ['Guardanapo'],
  },
  {
    pasta: 'Porta Guardanapos',
    id: 'portaGuardanapo',
    rotulo: 'Porta Guardanapos',
    descricao: 'Porta-guardanapos decorativos',
    prefixos: ['Porta Guardanapo'],
  },
  {
    pasta: 'Talheres',
    id: 'talher',
    rotulo: 'Talheres',
    descricao: 'Talheres de mesa e sobremesa',
    prefixos: [],
  },
  {
    pasta: 'Taças',
    id: 'taca',
    rotulo: 'Taças',
    descricao: 'Taças de vidro e cristal',
    prefixos: [],
  },
]

export const PASTA_PARA_CODIGO = Object.fromEntries(
  CATEGORIAS.map((c) => [c.pasta, c.id]),
)

const CORES = {
  lugarAmericano: { primaria: '#efe6d6', secundaria: '#f7f1e6', destaque: '#d4c4a8' },
  sousplat: { primaria: '#e8dcc8', secundaria: '#f5efe4', destaque: '#c4b49a' },
  pratoRaso: { primaria: '#faf8f5', secundaria: '#e8e4df', destaque: '#d0cbc4' },
  pratoFundo: { primaria: '#faf8f5', secundaria: '#e8e4df', destaque: '#d0cbc4' },
  pratoSobremesa: { primaria: '#faf8f5', secundaria: '#e8e4df', destaque: '#d0cbc4' },
  guardanapo: { primaria: '#f4f1ea', secundaria: '#e7e0d4', destaque: '#cfc6b8' },
  portaGuardanapo: { primaria: '#c4a574', secundaria: '#e8d4b0', destaque: '#8b6914' },
  talher: { primaria: '#d9d4cc', secundaria: '#f2efe9', destaque: '#b7b0a6' },
  taca: { primaria: '#d4e8f0', secundaria: '#eef6fa', destaque: '#a8c5d4' },
}

/** Usado quando o arquivo não traz centímetros (porta-guardanapos). */
const FALLBACK = {
  lugarAmericano: [48, 35],
  sousplat: [33, 33],
  pratoRaso: [27, 27],
  pratoFundo: [27, 27],
  pratoSobremesa: [20, 20],
  guardanapo: [45, 45],
  portaGuardanapo: [8, 8],
  talher: [3, 20],
  taca: [9, 20],
}

const SUFIXO_CM =
  /\s+-\s+(\d+(?:[.,]\d+)?)\s*cm(?:\s*x\s*(\d+(?:[.,]\d+)?)\s*cm(?:\s*x\s*(\d+(?:[.,]\d+)?)\s*cm)?)?\s*$/i

const TIPO_TALHER =
  /^(Colher|Faca|Garfo)(?:\s+de\s+(?:Mesa|Sobremesa)|\s+para\s+Churrasco)?\s+/i

const ORDEM_TIPO_TALHER = {
  garfo: 0,
  faca: 1,
  colher: 2,
}

function numeroCm(texto) {
  const n = parseFloat(texto.replace(',', '.'))
  return Number.isInteger(n) ? n : Math.round(n * 10) / 10
}

export function semAcentos(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '')
}

export function chaveItem(nome) {
  return semAcentos(nome).replace(/100_/g, '100%').toLowerCase()
}

function removerPrefixos(nome, prefixos) {
  const ordenados = [...prefixos].sort((a, b) => b.length - a.length)
  for (const prefixo of ordenados) {
    const escaped = prefixo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`^${escaped}\\s+`, 'i')
    if (re.test(nome)) return nome.replace(re, '').trim()
  }
  return nome.trim()
}

/**
 * @returns {{ nome: string, largura: number, comprimento: number, ehFrontal: boolean, usouFallback: boolean }}
 */
export function interpretarArquivo(nomeArquivo, codigo, prefixos = []) {
  const ehFrontal = /\bfrontal\b/i.test(nomeArquivo)
  const match = nomeArquivo.match(SUFIXO_CM)
  let nome = match ? nomeArquivo.slice(0, match.index) : nomeArquivo
  nome = nome.replace(/\s+frontal$/i, '').replace(/100_/g, '100%').trim()
  nome = removerPrefixos(nome, prefixos)

  if (!match) {
    const [largura, comprimento] = FALLBACK[codigo] ?? [30, 30]
    return { nome, largura, comprimento, ehFrontal, usouFallback: true }
  }

  const a = numeroCm(match[1])
  const b = match[2] ? numeroCm(match[2]) : null
  const c = match[3] ? numeroCm(match[3]) : null

  if (codigo === 'talher' && b != null && c == null) {
    return { nome, largura: b, comprimento: a, ehFrontal, usouFallback: false }
  }
  if (c != null) {
    return { nome, largura: a, comprimento: c, ehFrontal, usouFallback: false }
  }
  if (b != null) {
    return { nome, largura: a, comprimento: b, ehFrontal, usouFallback: false }
  }
  return { nome, largura: a, comprimento: a, ehFrontal, usouFallback: false }
}

/** Chave de família para agrupar peças da mesma linha (ex. Agra Capuccino). */
export function chaveFamilia(nome, codigo) {
  if (codigo === 'talher') {
    const m = nome.match(TIPO_TALHER)
    if (m) return chaveItem(nome.slice(m[0].length))
  }
  return chaveItem(nome)
}

function ordemTipoTalher(nome) {
  const m = nome.match(TIPO_TALHER)
  if (!m) return 9
  return ORDEM_TIPO_TALHER[semAcentos(m[1]).toLowerCase()] ?? 9
}

function compararItens(a, b, codigo) {
  const fa = chaveFamilia(a.nome, codigo)
  const fb = chaveFamilia(b.nome, codigo)
  const cmpFam = fa.localeCompare(fb, 'pt-BR')
  if (cmpFam !== 0) return cmpFam
  if (codigo === 'talher') {
    const cmpTipo = ordemTipoTalher(a.nome) - ordemTipoTalher(b.nome)
    if (cmpTipo !== 0) return cmpTipo
  }
  return a.nome.localeCompare(b.nome, 'pt-BR')
}

function listarImagens(dir) {
  const out = []
  for (const nome of readdirSync(dir)) {
    if (nome.startsWith('.') || nome.toLowerCase() === 'desktop.ini') continue
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) continue
    if (EXTS_IMAGEM.has(extname(nome).toLowerCase())) out.push(caminho)
  }
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

/**
 * Agrupa arquivos em itens com arquivoMesa / arquivoCatalogo.
 * @returns {{ catalogo: object, avisos: string[], arquivosPorChave: Map<string, { arquivoMesa?: string, arquivoCatalogo?: string }> }}
 */
export function gerarCatalogo(imgsRoot) {
  const itens = []
  const avisos = []
  /** codigo|chaveNome → arquivos */
  const arquivosPorChave = new Map()

  for (const categoria of CATEGORIAS) {
    const pasta = join(imgsRoot, categoria.pasta)
    let arquivos
    try {
      arquivos = listarImagens(pasta)
    } catch {
      avisos.push(`Pasta ausente: ${categoria.pasta}`)
      continue
    }

    /** @type {Map<string, { nome: string, largura: number, comprimento: number, usouFallback: boolean, arquivoMesa?: string, arquivoCatalogo?: string }>} */
    const porNome = new Map()

    for (const arquivo of arquivos) {
      const info = interpretarArquivo(
        basename(arquivo, extname(arquivo)),
        categoria.id,
        categoria.prefixos ?? [],
      )
      if (info.usouFallback && categoria.id !== 'portaGuardanapo') {
        avisos.push(`Sem medida: ${categoria.pasta}/${basename(arquivo)}`)
      }
      const chave = chaveItem(info.nome)
      const atual = porNome.get(chave) ?? {
        nome: info.nome,
        largura: info.largura,
        comprimento: info.comprimento,
        usouFallback: info.usouFallback,
      }

      if (info.ehFrontal) {
        atual.arquivoCatalogo = arquivo
      } else {
        atual.arquivoMesa = arquivo
        // Prefere dims da foto de mesa quando ambas existem.
        atual.largura = info.largura
        atual.comprimento = info.comprimento
        atual.usouFallback = info.usouFallback
        atual.nome = info.nome
      }
      porNome.set(chave, atual)
    }

    const lista = [...porNome.values()].sort((a, b) =>
      compararItens(a, b, categoria.id),
    )
    const ids = new Set()
    for (const info of lista) {
      let id = `${categoria.id}-${slugify(info.nome, { lower: true, strict: true })}`
      if (!id.endsWith('-') && ids.has(id)) {
        let n = 2
        while (ids.has(`${id}-${n}`)) n += 1
        id = `${id}-${n}`
      }
      ids.add(id)

      const chaveArquivo = `${categoria.id}|${chaveItem(info.nome)}`
      arquivosPorChave.set(chaveArquivo, {
        arquivoMesa: info.arquivoMesa,
        arquivoCatalogo: info.arquivoCatalogo,
      })

      itens.push({
        id,
        nome: info.nome,
        categoria: categoria.id,
        imagem: null,
        imagemCatalogo: null,
        cores: CORES[categoria.id],
        largura: info.largura,
        comprimento: info.comprimento,
        arquivoMesa: info.arquivoMesa ?? null,
        arquivoCatalogo: info.arquivoCatalogo ?? null,
      })
    }
  }

  return {
    catalogo: {
      categorias: CATEGORIAS.map(({ id, rotulo, descricao }) => ({
        id,
        rotulo,
        descricao,
      })),
      itens: itens.map(
        ({
          id,
          nome,
          categoria,
          imagem,
          imagemCatalogo,
          cores,
          largura,
          comprimento,
        }) => ({
          id,
          nome,
          categoria,
          imagem,
          imagemCatalogo,
          cores,
          largura,
          comprimento,
        }),
      ),
    },
    avisos,
    itensComArquivos: itens,
    arquivosPorChave,
  }
}

export function escreverCatalogo(imgsRoot, destino) {
  const { catalogo, avisos } = gerarCatalogo(imgsRoot)
  writeFileSync(destino, `${JSON.stringify(catalogo, null, 2)}\n`)
  return { catalogo, avisos }
}
