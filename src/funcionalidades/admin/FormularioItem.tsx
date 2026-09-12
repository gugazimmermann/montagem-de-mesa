import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { v4 as uuidv4 } from 'uuid'
import type { ItemMesa, PadraoTecido } from '../../compartilhado/tipos'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import { atualizarItem, criarItem } from '../../dados/repositorioClientes'
import { enviarImagemItemStorage, exigirUrlStorageOuVazio } from '../../dados/storage'
import { useAuth } from '../autenticacao'
import {
  AdminAlertaErro,
  AdminPaginaPainel,
  AdminPainelCarregando,
  AdminSessaoInvalida,
} from './AdminPaginaPainel'
import { AmpliarImagem } from './AmpliarImagem'
import { mapearErroUpload } from './adminUtils'
import { useDadosCliente } from './useDadosCliente'
import { useObjectUrlPreview } from './useObjectUrlPreview'
import './EditarCategoria.css'

const PADROES: { valor: PadraoTecido; rotulo: string }[] = [
  { valor: 'solid', rotulo: 'Liso' },
  { valor: 'linen', rotulo: 'Linho' },
  { valor: 'stripes', rotulo: 'Listras' },
  { valor: 'gingham', rotulo: 'Xadrez' },
  { valor: 'damask', rotulo: 'Damasco' },
  { valor: 'dots', rotulo: 'Poás' },
  { valor: 'herringbone', rotulo: 'Espinha de peixe' },
  { valor: 'border', rotulo: 'Borda' },
]

const COR_PADRAO = '#c4a574' // alinhar com --trial em index.css

interface FormItem {
  nome: string
  descricao: string
  imagem: string
  corPrimaria: string
  largura: string
  comprimento: string
  padrao: string
}

const formItemVazio: FormItem = {
  nome: '',
  descricao: '',
  imagem: '',
  corPrimaria: COR_PADRAO,
  largura: '',
  comprimento: '',
  padrao: '',
}

function itemParaForm(item: ItemMesa): FormItem {
  return {
    nome: item.nome,
    descricao: item.descricao ?? '',
    imagem: item.imagem ?? '',
    corPrimaria: item.cores.primaria,
    largura: item.largura != null ? String(item.largura) : '',
    comprimento: item.comprimento != null ? String(item.comprimento) : '',
    padrao: item.padrao ?? '',
  }
}

function montarItem(
  form: FormItem,
  categoriaId: string,
  idExistente: string | null,
  itemAnterior: ItemMesa | undefined,
  clienteId: string,
): ItemMesa | { erro: string } {
  const nome = form.nome.trim()
  if (!nome) return { erro: 'Informe o nome do item.' }

  const ehToalha = categoriaId === 'toalha'
  const id = idExistente ?? uuidv4()

  const corPrimaria = ehToalha
    ? form.corPrimaria.trim() || COR_PADRAO
    : itemAnterior?.cores.primaria ?? COR_PADRAO

  const item: ItemMesa = {
    id,
    nome,
    categoria: categoriaId,
    cores: {
      primaria: corPrimaria,
      ...(ehToalha && itemAnterior?.cores.secundaria
        ? { secundaria: itemAnterior.cores.secundaria }
        : {}),
      ...(ehToalha && itemAnterior?.cores.destaque
        ? { destaque: itemAnterior.cores.destaque }
        : {}),
    },
  }

  const descricao = form.descricao.trim()
  if (descricao) item.descricao = descricao

  const imagem = form.imagem.trim()
  if (imagem) {
    try {
      item.imagem = exigirUrlStorageOuVazio(imagem, 'URL da imagem', {
        clienteId,
        tipo: 'item',
      })
    } catch (e) {
      return {
        erro:
          e instanceof Error
            ? e.message
            : 'URL da imagem inválida. Use upload ou URL do Storage deste projeto.',
      }
    }
  }

  const largura = form.largura.trim() ? Number(form.largura) : undefined
  const comprimento = form.comprimento.trim() ? Number(form.comprimento) : undefined
  if (largura != null && (!Number.isFinite(largura) || largura < 0)) {
    return { erro: 'Largura inválida.' }
  }
  if (comprimento != null && (!Number.isFinite(comprimento) || comprimento < 0)) {
    return { erro: 'Comprimento inválido.' }
  }
  if (largura != null) item.largura = largura
  if (comprimento != null) item.comprimento = comprimento

  if (ehToalha && form.padrao && PADROES.some((p) => p.valor === form.padrao)) {
    item.padrao = form.padrao as PadraoTecido
  }

  return item
}

export function FormularioItem() {
  const { categoriaId, itemId } = useParams<{ categoriaId: string; itemId?: string }>()
  const navegar = useNavigate()
  const { cliente } = useAuth()
  const ehNovo = !itemId
  const ehToalha = categoriaId === 'toalha'

  const { dados, carregando, erro: erroCarga } = useDadosCliente(cliente?.id)
  const {
    arquivo: arquivoImagem,
    preview: previewImagem,
    escolher,
    limpar: limparPreview,
    accept,
  } = useObjectUrlPreview()

  const [formItem, setFormItem] = useState<FormItem>(formItemVazio)
  const [erro, setErro] = useState<string | null>(null)
  const [erroNome, setErroNome] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!dados || !itemId) return
    const existente = dados.itens.find((i) => i.id === itemId)
    if (existente) setFormItem(itemParaForm(existente))
  }, [dados, itemId])

  useEffect(() => {
    if (erroCarga) setErro(erroCarga)
  }, [erroCarga])

  if (!cliente) return <AdminSessaoInvalida />
  if (carregando) return <AdminPainelCarregando />

  const idCliente = cliente.id
  const categoria = dados?.categorias.find((c) => c.id === categoriaId)
  const itemExistente = itemId ? dados?.itens.find((i) => i.id === itemId) : undefined

  if (!categoriaId || !categoria || !dados) {
    return <Navigate to="/admin/painel" replace />
  }
  if (ehCategoriaFixa(categoriaId)) {
    return <Navigate to="/admin/painel" replace />
  }
  if (!ehNovo && (!itemExistente || itemExistente.categoria !== categoriaId)) {
    return <Navigate to={`/admin/painel/categorias/${categoriaId}`} replace />
  }

  const dadosAtuais = dados
  const idCategoria = categoriaId
  const voltarPara = `/admin/painel/categorias/${idCategoria}`
  const imagemExibida = previewImagem || formItem.imagem

  async function salvarItem(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)
    setErroNome(null)

    const itemAnterior = itemId
      ? dadosAtuais.itens.find((i) => i.id === itemId)
      : undefined

    const resultado = montarItem(
      formItem,
      idCategoria,
      itemId ?? null,
      itemAnterior,
      idCliente,
    )
    if ('erro' in resultado) {
      if (resultado.erro.includes('nome')) {
        setErroNome(resultado.erro)
      } else {
        setErro(resultado.erro)
      }
      return
    }

    setEnviando(true)
    try {
      if (arquivoImagem) {
        resultado.imagem = await enviarImagemItemStorage(
          idCliente,
          idCategoria,
          resultado.id,
          arquivoImagem,
        )
      }
      if (itemId) {
        await atualizarItem(idCliente, resultado)
      } else {
        await criarItem(idCliente, resultado)
      }
      navegar(voltarPara, {
        state: { flash: itemId ? 'Item atualizado.' : 'Item criado.' },
      })
    } catch (err) {
      setErro(mapearErroUpload(err, 'Não foi possível salvar o item.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <AdminPaginaPainel
      titulo={ehNovo ? 'Novo item' : 'Editar item'}
      breadcrumb={[
        { rotulo: 'Painel', para: '/admin/painel' },
        { rotulo: categoria.rotulo, para: voltarPara },
        { rotulo: ehNovo ? 'Novo item' : 'Editar item' },
      ]}
      voltarPara={voltarPara}
      alerta={erro ? <AdminAlertaErro>{erro}</AdminAlertaErro> : null}
    >
      <section className="admin-painel__secao">
        <form className="admin-painel__form" onSubmit={(e) => void salvarItem(e)}>
          <label className="admin-field">
            <span>Nome</span>
            <input
              type="text"
              value={formItem.nome}
              onChange={(e) => {
                setFormItem((f) => ({ ...f, nome: e.target.value }))
                setErroNome(null)
              }}
              required
              disabled={enviando}
              aria-invalid={erroNome ? true : undefined}
              aria-describedby={erroNome ? 'erro-nome-item' : undefined}
            />
            {erroNome && (
              <span id="erro-nome-item" className="admin-field__erro" role="alert">
                {erroNome}
              </span>
            )}
          </label>

          <label className="admin-field">
            <span>Descrição</span>
            <textarea
              rows={2}
              value={formItem.descricao}
              onChange={(e) => setFormItem((f) => ({ ...f, descricao: e.target.value }))}
              disabled={enviando}
            />
          </label>

          {ehToalha && (
            <label className="admin-field">
              <span>Cor primária</span>
              <input
                type="color"
                value={formItem.corPrimaria}
                onChange={(e) =>
                  setFormItem((f) => ({ ...f, corPrimaria: e.target.value }))
                }
                disabled={enviando}
              />
            </label>
          )}

          <div className="admin-itens__grid-campos">
            <label className="admin-field">
              <span>Largura (cm)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formItem.largura}
                onChange={(e) => setFormItem((f) => ({ ...f, largura: e.target.value }))}
                disabled={enviando}
              />
            </label>
            <label className="admin-field">
              <span>Comprimento (cm)</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formItem.comprimento}
                onChange={(e) =>
                  setFormItem((f) => ({ ...f, comprimento: e.target.value }))
                }
                disabled={enviando}
              />
            </label>
          </div>

          {ehToalha && (
            <>
              <label className="admin-field">
                <span>Padrão do tecido</span>
                <select
                  value={formItem.padrao}
                  onChange={(e) => setFormItem((f) => ({ ...f, padrao: e.target.value }))}
                  disabled={enviando}
                >
                  <option value="">Nenhum</option>
                  {PADROES.map((p) => (
                    <option key={p.valor} value={p.valor}>
                      {p.rotulo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Imagem (URL)</span>
                <input
                  type="text"
                  value={formItem.imagem}
                  placeholder={
                    arquivoImagem
                      ? 'Novo arquivo será enviado ao salvar'
                      : 'URL do Storage...'
                  }
                  onChange={(e) => {
                    limparPreview()
                    setFormItem((f) => ({ ...f, imagem: e.target.value }))
                  }}
                  disabled={enviando}
                />
              </label>
            </>
          )}

          <label className="admin-field">
            <span>{ehToalha ? 'Ou enviar arquivo' : 'Enviar arquivo'}</span>
            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                escolher(e)
                setErro(null)
              }}
              disabled={enviando}
            />
          </label>

          {imagemExibida && (
            <div className="admin-painel__logo-preview">
              <AmpliarImagem
                src={imagemExibida}
                alt={formItem.nome.trim() || 'Pré-visualização do item'}
              />
            </div>
          )}

          <div className="admin-painel__form-acoes">
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Salvando…' : ehNovo ? 'Criar item' : 'Salvar item'}
            </button>
            <Link className="btn btn--ghost" to={voltarPara}>
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </AdminPaginaPainel>
  )
}
