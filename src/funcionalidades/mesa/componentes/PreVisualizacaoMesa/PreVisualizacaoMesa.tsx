import type { CSSProperties, ReactNode } from 'react'
import { ImagemEstavel } from '../../../../compartilhado/ImagemEstavel'
import type { Categoria, ConfiguracaoMesa, ItemMesa } from '../../../../compartilhado/tipos'
import { imagemMesaItem } from '../../../../compartilhado/tipos'
import {
  idsSelecionados,
  obterItemPorId,
  obterItensPorIds,
} from '../../../catalogo'
import {
  dimensoesVisuaisGuardanapo,
  estiloCamadaDimensionada,
  GUARDANAPO_ALTURA_VISUAL_CM,
  inferirDimensoes,
  itemRedondo,
  PREVIEW_SCALE,
  PREVIEW_SCALE_GUARDANAPO,
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
import {
  type PosicaoCamada,
  posicionarPortaGuardanapo,
  posicionarTacas,
  posicionarTalheres,
  raioPratoVisualPct,
} from '../../layoutEtiqueta'
import './PreVisualizacaoMesa.css'
import '../../padroes-tecido.css'

interface PropsPreVisualizacaoMesa {
  configuracao: ConfiguracaoMesa
  categorias: Categoria[]
  itens: ItemMesa[]
  aoComecarVazio?: () => void
  aoAmpliarItem?: (item: ItemMesa) => void
}

function obterCategoriaPorCodigo(
  categorias: Categoria[],
  codigo: CodigoCamada,
): Categoria | null {
  return categorias.find((c) => chaveCamada(c) === codigo) ?? null
}

function obterItemPorCodigo(
  categorias: Categoria[],
  configuracao: ConfiguracaoMesa,
  itens: ItemMesa[],
  codigo: CodigoCamada,
): ItemMesa | null {
  const categoria = obterCategoriaPorCodigo(categorias, codigo)
  if (!categoria) return null
  const ids = idsSelecionados(configuracao[categoria.id])
  return obterItemPorId(itens, ids[0] ?? null)
}

function obterItensPorCodigo(
  categorias: Categoria[],
  configuracao: ConfiguracaoMesa,
  itens: ItemMesa[],
  codigo: CodigoCamada,
): ItemMesa[] {
  const categoria = obterCategoriaPorCodigo(categorias, codigo)
  if (!categoria) return []
  return obterItensPorIds(itens, idsSelecionados(configuracao[categoria.id]))
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

function estiloPosicao(posicao: PosicaoCamada): CSSProperties {
  const base: CSSProperties = {
    left: `${posicao.leftPct}%`,
    top: `${posicao.topPct}%`,
    zIndex: posicao.zIndex,
  }
  if (posicao.ancora === 'topoEsquerdo') {
    return {
      ...base,
      transform: posicao.rotateDeg
        ? `rotate(${posicao.rotateDeg}deg)`
        : 'none',
    }
  }
  return {
    ...base,
    transform: posicao.rotateDeg
      ? `translate(-50%, -50%) rotate(${posicao.rotateDeg}deg)`
      : 'translate(-50%, -50%)',
  }
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
  const podeAmpliar = Boolean(imagemMesaItem(item) && aoAmpliarItem)

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
  const srcImagem = imagemMesaItem(item)
  const comImagem = Boolean(srcImagem)
  const redondo = !comImagem && itemRedondo(comDim)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized sousplat ${redondo ? 'layer--round' : ''} ${comImagem ? 'sousplat--image' : ''}`}
      style={{ ...estiloDimensionado(comDim), ...(!comImagem ? varsCores(item) : {}) }}
    >
      {comImagem && <ImagemEstavel src={srcImagem!} alt="" draggable={false} />}
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
  const srcImagem = imagemMesaItem(item)
  const comImagem = Boolean(srcImagem)
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
        <ImagemEstavel src={srcImagem!} alt="" draggable={false} />
      ) : (
        <div className="plate__inner" />
      )}
    </CamadaClicavel>
  )
}

function CamadaFoto({
  item,
  codigo,
  classe,
  aoAmpliarItem,
  dimsOverride,
  scaleOverride,
  posicao,
}: {
  item: ItemMesa
  codigo: string
  classe: string
  aoAmpliarItem?: (item: ItemMesa) => void
  dimsOverride?: { largura: number; comprimento: number }
  scaleOverride?: number
  posicao?: PosicaoCamada
}) {
  const comDim = dimsOverride
    ? { ...item, ...dimsOverride }
    : itemComDimensoes(item, codigo)
  const srcImagem = imagemMesaItem(item)
  const comImagem = Boolean(srcImagem)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized ${classe} ${!comImagem ? 'layer--round' : ''}`}
      style={
        {
          ...estiloDimensionado(comDim),
          ...(scaleOverride != null
            ? { '--preview-scale': scaleOverride }
            : {}),
          ...(posicao ? estiloPosicao(posicao) : {}),
          ...(!comImagem ? varsCores(item) : {}),
        } as CSSProperties
      }
    >
      {comImagem && <ImagemEstavel src={srcImagem!} alt="" draggable={false} />}
    </CamadaClicavel>
  )
}

function CamadaTaca({
  item,
  aoAmpliarItem,
  posicao,
  larguraCm,
  comprimentoCm,
}: {
  item: ItemMesa
  aoAmpliarItem?: (item: ItemMesa) => void
  posicao: PosicaoCamada
  larguraCm: number
  comprimentoCm: number
}) {
  const srcImagem = imagemMesaItem(item)
  const comImagem = Boolean(srcImagem)

  return (
    <CamadaClicavel
      item={item}
      aoAmpliarItem={aoAmpliarItem}
      className={`layer layer--sized taca ${!comImagem ? 'layer--round' : ''}`}
      style={
        {
          ...estiloCamadaDimensionada({
            ...item,
            largura: larguraCm,
            comprimento: comprimentoCm,
          }),
          '--preview-scale': PREVIEW_SCALE_TACA,
          ...estiloPosicao(posicao),
          ...(!comImagem ? varsCores(item) : {}),
        } as CSSProperties
      }
    >
      {comImagem && <ImagemEstavel src={srcImagem!} alt="" draggable={false} />}
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
  const srcImagem = imagemMesaItem(item)
  const comImagem = Boolean(srcImagem)

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
      {comImagem && <ImagemEstavel src={srcImagem!} alt="" draggable={false} />}
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
  const lugarAmericano = obterItemPorCodigo(
    categorias,
    configuracao,
    itens,
    'lugarAmericano',
  )
  const sousplat = obterItemPorCodigo(categorias, configuracao, itens, 'sousplat')
  const pratoRaso = obterItemPorCodigo(categorias, configuracao, itens, 'pratoRaso')
  const pratoFundo = obterItemPorCodigo(categorias, configuracao, itens, 'pratoFundo')
  const pratoSobremesa = obterItemPorCodigo(
    categorias,
    configuracao,
    itens,
    'pratoSobremesa',
  )
  const guardanapo = obterItemPorCodigo(categorias, configuracao, itens, 'guardanapo')
  const portaGuardanapo = obterItemPorCodigo(
    categorias,
    configuracao,
    itens,
    'portaGuardanapo',
  )
  const talheres = obterItensPorCodigo(categorias, configuracao, itens, 'talher')
  const tacas = obterItensPorCodigo(categorias, configuracao, itens, 'taca')

  const genericas = categorias
    .filter((c) => !ehCodigoCamadaConhecido(chaveCamada(c)))
    .flatMap((c) =>
      obterItensPorIds(itens, idsSelecionados(configuracao[c.id])),
    )

  const ancoraCm = sousplat
    ? itemComDimensoes(sousplat, 'sousplat').largura
    : pratoRaso
      ? itemComDimensoes(pratoRaso, 'pratoRaso').largura
      : GUARDANAPO_ALTURA_VISUAL_CM

  const dimsGuardanapo = dimensoesVisuaisGuardanapo(
    guardanapo ?? ({ nome: '' } as ItemMesa),
    Math.min(ancoraCm, GUARDANAPO_ALTURA_VISUAL_CM + 2),
  )

  const raioPratoPct = raioPratoVisualPct(ancoraCm, PREVIEW_SCALE_PRATO)

  const talheresPos = posicionarTalheres(talheres, raioPratoPct)
  const tacasPos = posicionarTacas(tacas, raioPratoPct, {
    comLugarAmericano: Boolean(lugarAmericano),
    comSousplat: Boolean(sousplat),
  })
  const portaPos =
    guardanapo && portaGuardanapo
      ? posicionarPortaGuardanapo(portaGuardanapo, dimsGuardanapo.comprimento)
      : null

  const resumo = [
    toalha,
    lugarAmericano,
    sousplat,
    pratoRaso,
    pratoFundo,
    pratoSobremesa,
    guardanapo,
    portaPos?.item,
    ...talheresPos.map((t) => t.item),
    ...tacasPos.map((t) => t.item),
    ...genericas,
  ]
    .filter(Boolean)
    .map((item) => item!.nome)
    .join(', ')

  const vazia =
    !toalha &&
    !lugarAmericano &&
    !sousplat &&
    !pratoRaso &&
    !pratoFundo &&
    !pratoSobremesa &&
    !guardanapo &&
    !portaPos &&
    talheresPos.length === 0 &&
    tacasPos.length === 0 &&
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
          className={`place-setting${lugarAmericano ? ' place-setting--lugar-americano' : ''}`}
          style={
            {
              '--preview-reference-cm': REFERENCIA_PREVIEW_CM,
              '--preview-scale': PREVIEW_SCALE,
            } as CSSProperties
          }
        >
          {lugarAmericano && (
            <CamadaFoto
              item={lugarAmericano}
              codigo="lugarAmericano"
              classe="lugar-americano"
              aoAmpliarItem={aoAmpliarItem}
            />
          )}
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
          {guardanapo && (
            <CamadaFoto
              item={guardanapo}
              codigo="guardanapo"
              classe="guardanapo"
              aoAmpliarItem={aoAmpliarItem}
              dimsOverride={dimsGuardanapo}
              scaleOverride={PREVIEW_SCALE_GUARDANAPO}
            />
          )}
          {portaPos && (
            <CamadaFoto
              item={portaPos.item}
              codigo="portaGuardanapo"
              classe="porta-guardanapo"
              aoAmpliarItem={aoAmpliarItem}
              dimsOverride={{
                largura: portaPos.larguraCm,
                comprimento: portaPos.comprimentoCm,
              }}
              posicao={portaPos.posicao}
            />
          )}
          {talheresPos.map(({ item, posicao, larguraCm, comprimentoCm }) => (
            <CamadaFoto
              key={`talher-${item.id}`}
              item={item}
              codigo="talher"
              classe="talher"
              aoAmpliarItem={aoAmpliarItem}
              dimsOverride={{ largura: larguraCm, comprimento: comprimentoCm }}
              posicao={posicao}
            />
          ))}
          {tacasPos.map(({ item, posicao, larguraCm, comprimentoCm }) => (
            <CamadaTaca
              key={`taca-${item.id}`}
              item={item}
              aoAmpliarItem={aoAmpliarItem}
              posicao={posicao}
              larguraCm={larguraCm}
              comprimentoCm={comprimentoCm}
            />
          ))}
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
            <p>Toque numa peça nas categorias para montar a mesa</p>
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
