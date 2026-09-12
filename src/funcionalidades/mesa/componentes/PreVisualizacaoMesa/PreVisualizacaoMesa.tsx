import type { CSSProperties, ReactNode } from 'react'
import type { Categoria, ConfiguracaoMesa, ItemMesa } from '../../../../compartilhado/tipos'
import { obterItemPorId } from '../../../catalogo'
import {
  estiloCamadaDimensionada,
  inferirDimensoes,
  itemRedondo,
  PREVIEW_SCALE,
  PREVIEW_SCALE_PRATO,
  PREVIEW_SCALE_TACA,
  REFERENCIA_PREVIEW_CM,
  temDimensoes,
} from '../../../../compartilhado/utils/dimensoes'
import {
  type CodigoCamada,
  ehCodigoCamadaConhecido,
  chaveCamada,
} from '../../ordemCamadas'
import './PreVisualizacaoMesa.css'
import '../../padroes-tecido.css'

interface PropsPreVisualizacaoMesa {
  configuracao: ConfiguracaoMesa
  categorias: Categoria[]
  itens: ItemMesa[]
  aoComecarVazio?: () => void
  aoAmpliarItem?: (item: ItemMesa) => void
}

function obterItemPorCodigo(
  categorias: Categoria[],
  configuracao: ConfiguracaoMesa,
  itens: ItemMesa[],
  codigo: CodigoCamada,
): ItemMesa | null {
  const categoria = categorias.find((c) => chaveCamada(c) === codigo)
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

/** Dimensões reais ou inferidas — evita sumir do preview quando o admin omite cm. */
function itemComDimensoes(
  item: ItemMesa,
  codigo: string,
): ItemMesa & { largura: number; comprimento: number } {
  if (temDimensoes(item)) return item
  const inferidas = inferirDimensoes(item.nome, codigo)
  return { ...item, ...inferidas }
}

function estiloDimensionado(
  item: ItemMesa & { largura: number; comprimento: number },
): CSSProperties {
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
  const comDim = itemComDimensoes(item, 'sousplat')
  const comImagem = Boolean(item.imagem)
  const redondo = !comImagem && itemRedondo(comDim)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized sousplat ${redondo ? 'layer--round' : ''} ${comImagem ? 'sousplat--image' : ''}`}
      style={{ ...estiloDimensionado(comDim), ...(!comImagem ? varsCores(item) : {}) }}
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
  const codigo =
    variante === 'fundo'
      ? 'pratoFundo'
      : variante === 'sobremesa'
        ? 'pratoSobremesa'
        : 'pratoRaso'
  const comDim = itemComDimensoes(item, codigo)
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
          ...estiloDimensionado(comDim),
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
  const comDim = itemComDimensoes(item, 'portaGuardanapo')
  const comImagem = Boolean(item.imagem)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized porta-guardanapo ${!comImagem ? 'layer--round' : ''}`}
      style={{
        ...estiloDimensionado(comDim),
        ...(!comImagem ? varsCores(item) : {}),
      }}
    >
      {comImagem && <img src={item.imagem} alt="" draggable={false} />}
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
  const comDim = itemComDimensoes(item, 'taca')
  const comImagem = Boolean(item.imagem)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized taca ${!comImagem ? 'layer--round' : ''}`}
      style={
        {
          ...estiloDimensionado(comDim),
          '--preview-scale': PREVIEW_SCALE_TACA,
          ...(!comImagem ? varsCores(item) : {}),
        } as CSSProperties
      }
    >
      {comImagem && <img src={item.imagem} alt="" draggable={false} />}
    </CamadaClicavel>
  )
}

/** Camada genérica para categorias customizadas com imagem ou cor. */
function CamadaGenerica({
  item,
  aoAmpliarItem,
}: {
  item: ItemMesa
  aoAmpliarItem?: (item: ItemMesa) => void
}) {
  const comDim = itemComDimensoes(item, item.categoria)
  const comImagem = Boolean(item.imagem)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized layer--generica ${!comImagem ? 'layer--round' : ''}`}
      style={{
        ...estiloDimensionado(comDim),
        ...(!comImagem ? varsCores(item) : {}),
      }}
    >
      {comImagem && <img src={item.imagem} alt="" draggable={false} />}
    </CamadaClicavel>
  )
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
    .filter((c) => !ehCodigoCamadaConhecido(chaveCamada(c)))
    .map((c) => obterItemPorId(itens, configuracao[c.id] ?? null))
    .filter((item): item is ItemMesa => Boolean(item))

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
            <p>Toque numa peça abaixo para montar a mesa</p>
            {aoComecarVazio && (
              <button type="button" className="btn btn--ghost" onClick={aoComecarVazio}>
                Ir para as categorias
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
