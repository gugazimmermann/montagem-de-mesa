import type { CSSProperties, ReactNode } from 'react'
import type { Categoria, ConfiguracaoMesa, ItemMesa } from '../../../../compartilhado/tipos'
import { obterItemPorId } from '../../../catalogo'
import {
  estiloCamadaDimensionada,
  itemRedondo,
  PREVIEW_SCALE,
  PREVIEW_SCALE_PRATO,
  PREVIEW_SCALE_TACA,
  REFERENCIA_PREVIEW_CM,
  temDimensoes,
} from '../../../../compartilhado/utils/dimensoes'
import './PreVisualizacaoMesa.css'
import '../../padroes-tecido.css'

interface PropsPreVisualizacaoMesa {
  configuracao: ConfiguracaoMesa
  categorias: Categoria[]
  itens: ItemMesa[]
  aoComecarVazio?: () => void
  aoAmpliarItem?: (item: ItemMesa) => void
}

const CODIGOS_CAMADA = [
  'toalha',
  'sousplat',
  'pratoRaso',
  'pratoFundo',
  'pratoSobremesa',
  'portaGuardanapo',
  'taca',
] as const

type CodigoCamada = (typeof CODIGOS_CAMADA)[number]

function obterItemPorCodigo(
  categorias: Categoria[],
  configuracao: ConfiguracaoMesa,
  itens: ItemMesa[],
  codigo: CodigoCamada,
): ItemMesa | null {
  const categoria = categorias.find((c) => (c.codigo ?? c.id) === codigo)
  if (!categoria) return null
  return obterItemPorId(itens, configuracao[categoria.id] ?? null)
}

function varsCores(item: ItemMesa): CSSProperties {
  const { primaria, secundaria = primaria, destaque = primaria } = item.cores
  return {
    '--c-primary': primaria,
    '--c-secondary': secundaria,
    '--c-accent': destaque,
  } as CSSProperties
}

function estiloDimensionado(item: ItemMesa): CSSProperties {
  if (!temDimensoes(item)) return {}
  return estiloCamadaDimensionada(item)
}

function CamadaToalha({ item }: { item: ItemMesa }) {
  const padrao = item.padrao ?? 'solid'

  return (
    <div
      className={`tablecloth padrao--${padrao}${padrao === 'border' ? ' tablecloth--border' : ''}`}
      style={varsCores(item)}
      aria-hidden="true"
    />
  )
}

type PropsCamadaClicavel = {
  item: ItemMesa
  aoAmpliarItem?: (item: ItemMesa) => void
  className: string
  style?: CSSProperties
  children: ReactNode
}

function CamadaClicavel({
  item,
  aoAmpliarItem,
  className,
  style,
  children,
}: PropsCamadaClicavel) {
  const podeAmpliar = Boolean(item.imagem && aoAmpliarItem)

  if (!podeAmpliar) {
    return (
      <div className={className} style={style} aria-hidden="true">
        {children}
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`${className} layer--clicavel`}
      style={style}
      onClick={() => aoAmpliarItem!(item)}
      aria-label={`Ampliar imagem de ${item.nome}`}
    >
      {children}
    </button>
  )
}

function CamadaSousplat({
  item,
  aoAmpliarItem,
}: {
  item: ItemMesa
  aoAmpliarItem?: (item: ItemMesa) => void
}) {
  if (!temDimensoes(item)) return null

  const comImagem = Boolean(item.imagem)
  const redondo = !comImagem && itemRedondo(item)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized sousplat ${redondo ? 'layer--round' : ''} ${comImagem ? 'sousplat--image' : ''}`}
      style={{ ...estiloDimensionado(item), ...(!comImagem ? varsCores(item) : {}) }}
    >
      {comImagem && <img src={item.imagem} alt="" draggable={false} />}
    </CamadaClicavel>
  )
}

function CamadaPrato({
  item,
  variante,
  aoAmpliarItem,
}: {
  item: ItemMesa
  variante: 'raso' | 'fundo' | 'sobremesa'
  aoAmpliarItem?: (item: ItemMesa) => void
}) {
  if (!temDimensoes(item)) return null

  const comImagem = Boolean(item.imagem)
  const classeVariante =
    variante === 'fundo'
      ? 'plate--fundo'
      : variante === 'sobremesa'
        ? 'plate--sobremesa'
        : 'plate--raso'

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized plate ${classeVariante} ${comImagem ? 'plate--image' : 'layer--round'}`}
      style={
        {
          ...estiloDimensionado(item),
          '--preview-scale': PREVIEW_SCALE_PRATO,
          ...(!comImagem ? varsCores(item) : {}),
        } as CSSProperties
      }
    >
      {comImagem ? (
        <img src={item.imagem} alt="" draggable={false} />
      ) : (
        <div className="plate__inner" />
      )}
    </CamadaClicavel>
  )
}

function CamadaPortaGuardanapo({
  item,
  aoAmpliarItem,
}: {
  item: ItemMesa
  aoAmpliarItem?: (item: ItemMesa) => void
}) {
  if (!temDimensoes(item)) return null

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className="layer layer--sized porta-guardanapo"
      style={estiloDimensionado(item)}
    >
      {item.imagem && <img src={item.imagem} alt="" draggable={false} />}
    </CamadaClicavel>
  )
}

function CamadaTaca({
  item,
  aoAmpliarItem,
}: {
  item: ItemMesa
  aoAmpliarItem?: (item: ItemMesa) => void
}) {
  if (!temDimensoes(item)) return null

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className="layer layer--sized taca"
      style={
        {
          ...estiloDimensionado(item),
          '--preview-scale': PREVIEW_SCALE_TACA,
        } as CSSProperties
      }
    >
      {item.imagem && <img src={item.imagem} alt="" draggable={false} />}
    </CamadaClicavel>
  )
}

/** Camada genérica para categorias customizadas com imagem. */
function CamadaGenerica({
  item,
  aoAmpliarItem,
}: {
  item: ItemMesa
  aoAmpliarItem?: (item: ItemMesa) => void
}) {
  if (!item.imagem) return null
  if (!temDimensoes(item)) {
    return (
      <CamadaClicavel
        item={item}
        aoAmpliarItem={aoAmpliarItem}
        className="layer layer--sized layer--generica"
      >
        <img src={item.imagem} alt="" draggable={false} />
      </CamadaClicavel>
    )
  }

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className="layer layer--sized layer--generica"
      style={estiloDimensionado(item)}
    >
      <img src={item.imagem} alt="" draggable={false} />
    </CamadaClicavel>
  )
}

function ehCodigoCamadaConhecido(codigo: string): codigo is CodigoCamada {
  return (CODIGOS_CAMADA as readonly string[]).includes(codigo)
}

export function PreVisualizacaoMesa({
  configuracao,
  categorias,
  itens,
  aoComecarVazio,
  aoAmpliarItem,
}: PropsPreVisualizacaoMesa) {
  const toalha = obterItemPorCodigo(categorias, configuracao, itens, 'toalha')
  const sousplat = obterItemPorCodigo(categorias, configuracao, itens, 'sousplat')
  const pratoRaso = obterItemPorCodigo(categorias, configuracao, itens, 'pratoRaso')
  const pratoFundo = obterItemPorCodigo(categorias, configuracao, itens, 'pratoFundo')
  const pratoSobremesa = obterItemPorCodigo(
    categorias,
    configuracao,
    itens,
    'pratoSobremesa',
  )
  const portaGuardanapo = obterItemPorCodigo(
    categorias,
    configuracao,
    itens,
    'portaGuardanapo',
  )
  const taca = obterItemPorCodigo(categorias, configuracao, itens, 'taca')

  const genericas = categorias
    .filter((c) => {
      const chave = c.codigo ?? c.id
      return !ehCodigoCamadaConhecido(chave)
    })
    .map((c) => obterItemPorId(itens, configuracao[c.id] ?? null))
    .filter((item): item is ItemMesa => Boolean(item?.imagem))

  const resumo = [
    toalha,
    sousplat,
    pratoRaso,
    pratoFundo,
    pratoSobremesa,
    portaGuardanapo,
    taca,
    ...genericas,
  ]
    .filter(Boolean)
    .map((item) => item!.nome)
    .join(', ')

  const vazia =
    !toalha &&
    !sousplat &&
    !pratoRaso &&
    !pratoFundo &&
    !pratoSobremesa &&
    !portaGuardanapo &&
    !taca &&
    genericas.length === 0

  return (
    <div
      className="table-preview"
      role="group"
      aria-label={`Montagem de mesa: ${resumo || 'vazia'}`}
    >
      <div className={`table-surface ${toalha ? 'table-surface--cloth' : ''}`}>
        {toalha && <CamadaToalha item={toalha} />}
        <div className="table-edge" />
        <div
          className="place-setting"
          style={
            {
              '--preview-reference-cm': REFERENCIA_PREVIEW_CM,
              '--preview-scale': PREVIEW_SCALE,
            } as CSSProperties
          }
        >
          {sousplat && (
            <CamadaSousplat item={sousplat} aoAmpliarItem={aoAmpliarItem} />
          )}
          {pratoRaso && (
            <CamadaPrato
              item={pratoRaso}
              variante="raso"
              aoAmpliarItem={aoAmpliarItem}
            />
          )}
          {pratoFundo && (
            <CamadaPrato
              item={pratoFundo}
              variante="fundo"
              aoAmpliarItem={aoAmpliarItem}
            />
          )}
          {pratoSobremesa && (
            <CamadaPrato
              item={pratoSobremesa}
              variante="sobremesa"
              aoAmpliarItem={aoAmpliarItem}
            />
          )}
          {portaGuardanapo && (
            <CamadaPortaGuardanapo
              item={portaGuardanapo}
              aoAmpliarItem={aoAmpliarItem}
            />
          )}
          {taca && <CamadaTaca item={taca} aoAmpliarItem={aoAmpliarItem} />}
          {genericas.map((item) => (
            <CamadaGenerica
              key={item.id}
              item={item}
              aoAmpliarItem={aoAmpliarItem}
            />
          ))}
        </div>
        {vazia && (
          <div className="table-preview__empty">
            <p>Selecione itens para montar a mesa</p>
            {aoComecarVazio && (
              <button type="button" className="btn btn--ghost" onClick={aoComecarVazio}>
                Começar pela primeira categoria
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
