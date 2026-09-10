import type { CSSProperties } from 'react'
import type { ConfiguracaoMesa, ItemMesa } from '../../../../compartilhado/tipos'
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

interface PropsPreVisualizacaoMesa {
  configuracao: ConfiguracaoMesa
  itens: ItemMesa[]
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
      className={`tablecloth tablecloth--${padrao}`}
      style={varsCores(item)}
      aria-label={item.nome}
    />
  )
}

function CamadaSousplat({ item }: { item: ItemMesa }) {
  if (!temDimensoes(item)) return null

  const comImagem = Boolean(item.imagem)
  const redondo = !comImagem && itemRedondo(item)

  return (
    <div
      className={`layer layer--sized sousplat ${redondo ? 'layer--round' : ''} ${comImagem ? 'sousplat--image' : ''}`}
      style={{ ...estiloDimensionado(item), ...(!comImagem ? varsCores(item) : {}) }}
      aria-label={item.nome}
    >
      {comImagem && <img src={item.imagem} alt="" draggable={false} />}
    </div>
  )
}

function CamadaPrato({
  item,
  variante,
}: {
  item: ItemMesa
  variante: 'raso' | 'fundo' | 'sobremesa'
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
    <div
      className={`layer layer--sized plate ${classeVariante} ${comImagem ? 'plate--image' : 'layer--round'}`}
      style={
        {
          ...estiloDimensionado(item),
          '--preview-scale': PREVIEW_SCALE_PRATO,
          ...(!comImagem ? varsCores(item) : {}),
        } as CSSProperties
      }
      aria-label={item.nome}
    >
      {comImagem ? (
        <img src={item.imagem} alt="" draggable={false} />
      ) : (
        <div className="plate__inner" />
      )}
    </div>
  )
}

function CamadaPortaGuardanapo({ item }: { item: ItemMesa }) {
  if (!temDimensoes(item)) return null

  return (
    <div
      className="layer layer--sized porta-guardanapo"
      style={estiloDimensionado(item)}
      aria-label={item.nome}
    >
      {item.imagem && <img src={item.imagem} alt="" draggable={false} />}
    </div>
  )
}

function CamadaTaca({ item }: { item: ItemMesa }) {
  if (!temDimensoes(item)) return null

  return (
    <div
      className="layer layer--sized taca"
      style={
        {
          ...estiloDimensionado(item),
          '--preview-scale': PREVIEW_SCALE_TACA,
        } as CSSProperties
      }
      aria-label={item.nome}
    >
      {item.imagem && <img src={item.imagem} alt="" draggable={false} />}
    </div>
  )
}

export function PreVisualizacaoMesa({ configuracao, itens }: PropsPreVisualizacaoMesa) {
  const toalha = obterItemPorId(itens, configuracao.toalha ?? null)
  const sousplat = obterItemPorId(itens, configuracao.sousplat ?? null)
  const pratoRaso = obterItemPorId(itens, configuracao.pratoRaso ?? null)
  const pratoFundo = obterItemPorId(itens, configuracao.pratoFundo ?? null)
  const pratoSobremesa = obterItemPorId(itens, configuracao.pratoSobremesa ?? null)
  const portaGuardanapo = obterItemPorId(itens, configuracao.portaGuardanapo ?? null)
  const taca = obterItemPorId(itens, configuracao.taca ?? null)

  const resumo = [toalha, sousplat, pratoRaso, pratoFundo, pratoSobremesa, portaGuardanapo, taca]
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
    !taca

  return (
    <div
      className="table-preview"
      role="img"
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
          {sousplat && <CamadaSousplat item={sousplat} />}
          {pratoRaso && <CamadaPrato item={pratoRaso} variante="raso" />}
          {pratoFundo && <CamadaPrato item={pratoFundo} variante="fundo" />}
          {pratoSobremesa && <CamadaPrato item={pratoSobremesa} variante="sobremesa" />}
          {portaGuardanapo && <CamadaPortaGuardanapo item={portaGuardanapo} />}
          {taca && <CamadaTaca item={taca} />}
        </div>
        {vazia && <p className="table-preview__empty">Selecione itens para montar a mesa</p>}
      </div>
    </div>
  )
}
