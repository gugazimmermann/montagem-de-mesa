import type { Categoria, ItemMesa } from '../compartilhado/tipos'
import { CadastroErro } from './erros'
import { supabase } from './supabase'

export async function criarCategoria(
  clienteId: string,
  categoria: Categoria,
): Promise<void> {
  const { data: ordem, error: erroOrdem } = await supabase.rpc(
    'proximo_ordem_categoria',
    { p_cliente_id: clienteId },
  )
  if (erroOrdem) throw erroOrdem

  const { error } = await supabase.from('categorias').insert({
    cliente_id: clienteId,
    id: categoria.id,
    codigo: categoria.codigo ?? null,
    rotulo: categoria.rotulo,
    descricao: categoria.descricao,
    ordem: typeof ordem === 'number' ? ordem : 0,
  })

  if (error) throw error
}

export async function atualizarCategoria(
  clienteId: string,
  categoria: Categoria,
): Promise<void> {
  const { data, error } = await supabase
    .from('categorias')
    .update({
      rotulo: categoria.rotulo,
      descricao: categoria.descricao,
    })
    .eq('cliente_id', clienteId)
    .eq('id', categoria.id)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new CadastroErro(
      'Não foi possível atualizar a categoria. Verifique sua assinatura ou tente novamente.',
    )
  }
}

export async function excluirCategoriaDb(
  clienteId: string,
  categoriaId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('categorias')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('id', categoriaId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new CadastroErro(
      'Não foi possível excluir a categoria. Verifique sua assinatura ou tente novamente.',
    )
  }
}

export async function criarItem(clienteId: string, item: ItemMesa): Promise<void> {
  const { data: ordem, error: erroOrdem } = await supabase.rpc('proximo_ordem_item', {
    p_cliente_id: clienteId,
    p_categoria_id: item.categoria,
  })
  if (erroOrdem) throw erroOrdem

  const { error } = await supabase.from('itens').insert({
    cliente_id: clienteId,
    id: item.id,
    categoria_id: item.categoria,
    nome: item.nome,
    imagem: item.imagem ?? null,
    cores: item.cores,
    largura: item.largura ?? null,
    comprimento: item.comprimento ?? null,
    padrao: item.padrao ?? null,
    descricao: item.descricao ?? null,
    ordem: typeof ordem === 'number' ? ordem : 0,
  })

  if (error) throw error
}

export async function atualizarItem(clienteId: string, item: ItemMesa): Promise<void> {
  const { data, error } = await supabase
    .from('itens')
    .update({
      nome: item.nome,
      imagem: item.imagem ?? null,
      cores: item.cores,
      largura: item.largura ?? null,
      comprimento: item.comprimento ?? null,
      padrao: item.padrao ?? null,
      descricao: item.descricao ?? null,
      categoria_id: item.categoria,
    })
    .eq('cliente_id', clienteId)
    .eq('id', item.id)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new CadastroErro(
      'Não foi possível atualizar o item. Verifique sua assinatura ou tente novamente.',
    )
  }
}

export async function excluirItemDb(clienteId: string, itemId: string): Promise<void> {
  const { data, error } = await supabase
    .from('itens')
    .delete()
    .eq('cliente_id', clienteId)
    .eq('id', itemId)
    .select('id')
    .maybeSingle()

  if (error) throw error
  if (!data) {
    throw new CadastroErro(
      'Não foi possível excluir o item. Verifique sua assinatura ou tente novamente.',
    )
  }
}
