import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import type { DadosCliente, ItemMesa, PadraoTecido } from '../../compartilhado/tipos'
import { ehCategoriaFixa } from '../../dados/categoriasFixas'
import {
  atualizarItem,
  carregarDadosCliente,
  criarItem,
  slugifyCategoria,
} from '../../dados/repositorioClientes'
import { useAuth } from '../autenticacao'
import './PainelAdmin.css'
import './LoginAdmin.css'
import './EditarCategoria.css'

const PADROES: PadraoTecido[] = [
  'solid',
  'linen',
  'stripes',
  'gingham',
  'damask',
  'dots',
  'herringbone',
  'border',
]

const COR_PADRAO = '#c4a574'

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
  idsUsados: Set<string>,
  itemAnterior?: ItemMesa,
): ItemMesa | { erro: string } {
  const nome = form.nome.trim()
  if (!nome) return { erro: 'Informe o nome do item.' }

  const ehToalha = categoriaId === 'toalha'
  let id = idExistente
  if (!id) {
    id = slugifyCategoria(nome)
    if (idsUsados.has(id)) id = `${id}-${Date.now()}`
  }

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
  if (imagem) item.imagem = imagem

  const largura = form.largura.trim() ? Number(form.largura) : undefined
  const comprimento = form.comprimento.trim() ? Number(form.comprimento) : undefined
  if (largura != null && !Number.isFinite(largura)) {
    return { erro: 'Largura inválida.' }
  }
  if (comprimento != null && !Number.isFinite(comprimento)) {
    return { erro: 'Comprimento inválido.' }
  }
  if (largura != null) item.largura = largura
  if (comprimento != null) item.comprimento = comprimento

  if (ehToalha && form.padrao && PADROES.includes(form.padrao as PadraoTecido)) {
    item.padrao = form.padrao as PadraoTecido
  }

  return item
}

export function FormularioItem() {
  const { categoriaId, itemId } = useParams<{ categoriaId: string; itemId?: string }>()
  const navegar = useNavigate()
  const { cliente } = useAuth()
  const clienteId = cliente!.id
  const ehNovo = !itemId
  const ehToalha = categoriaId === 'toalha'

  const [dados, setDados] = useState<DadosCliente | null>(null)
  const [formItem, setFormItem] = useState<FormItem>(formItemVazio)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let ativo = true
    void carregarDadosCliente(clienteId)
      .then((d) => {
        if (!ativo || !d) return
        setDados(d)
        const existente = itemId ? d.itens.find((i) => i.id === itemId) : undefined
        if (existente) setFormItem(itemParaForm(existente))
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível carregar o item.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [clienteId, itemId])

  if (carregando) {
    return (
      <div className="admin-painel">
        <p className="admin-painel__alerta">Carregando…</p>
      </div>
    )
  }

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

  const voltarPara = `/admin/painel/categorias/${categoriaId}`

  async function salvarItem(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    const idsUsados = new Set(dados!.itens.map((i) => i.id))
    const itemAnterior = itemId ? dados!.itens.find((i) => i.id === itemId) : undefined

    const resultado = montarItem(
      formItem,
      categoriaId!,
      itemId ?? null,
      idsUsados,
      itemAnterior,
    )
    if ('erro' in resultado) {
      setErro(resultado.erro)
      return
    }

    setEnviando(true)
    try {
      if (itemId) {
        await atualizarItem(clienteId, resultado)
      } else {
        await criarItem(clienteId, resultado)
      }
      navegar(voltarPara)
    } catch {
      setErro('Não foi possível salvar o item.')
    } finally {
      setEnviando(false)
    }
  }

  function aoEscolherImagem(evento: ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return

    const leitor = new FileReader()
    leitor.onload = () => {
      if (typeof leitor.result === 'string') {
        setFormItem((f) => ({ ...f, imagem: leitor.result as string }))
      }
    }
    leitor.readAsDataURL(arquivo)
  }

  return (
    <div className="admin-painel">
      <header className="admin-painel__header">
        <div>
          <p className="admin-painel__eyebrow">{categoria.rotulo}</p>
          <h1>{ehNovo ? 'Novo item' : 'Editar item'}</h1>
          {!ehNovo && itemExistente && (
            <span className="admin-categorias__id">{itemExistente.id}</span>
          )}
        </div>
        <div className="admin-painel__acoes">
          <Link className="btn btn--ghost" to={voltarPara}>
            Voltar
          </Link>
        </div>
      </header>

      {erro && (
        <p className="admin-painel__alerta admin-painel__alerta--erro" role="alert">
          {erro}
        </p>
      )}

      <section className="admin-painel__secao">
        <form className="admin-painel__form" onSubmit={(e) => void salvarItem(e)}>
          <label className="admin-field">
            <span>Nome</span>
            <input
              type="text"
              value={formItem.nome}
              onChange={(e) => setFormItem((f) => ({ ...f, nome: e.target.value }))}
              required
              disabled={enviando}
            />
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
                onChange={(e) => setFormItem((f) => ({ ...f, corPrimaria: e.target.value }))}
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
                onChange={(e) => setFormItem((f) => ({ ...f, comprimento: e.target.value }))}
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
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Imagem (URL)</span>
                <input
                  type="text"
                  value={formItem.imagem.startsWith('data:') ? '' : formItem.imagem}
                  placeholder={
                    formItem.imagem.startsWith('data:')
                      ? 'Imagem carregada do computador'
                      : '/imgs/...'
                  }
                  onChange={(e) => setFormItem((f) => ({ ...f, imagem: e.target.value }))}
                  disabled={enviando}
                />
              </label>
            </>
          )}

          <label className="admin-field">
            <span>{ehToalha ? 'Ou enviar arquivo' : 'Enviar arquivo'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={aoEscolherImagem}
              disabled={enviando}
            />
          </label>

          {formItem.imagem && (
            <div className="admin-painel__logo-preview">
              <img src={formItem.imagem} alt="" />
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
    </div>
  )
}
