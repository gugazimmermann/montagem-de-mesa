import type {
  DadosVisitanteMontagem,
  ItemMontagemEnviado,
} from '../../dados/enviarMontagem'

export function montarTextoMontagem(params: {
  visitante: DadosVisitanteMontagem
  itens: ItemMontagemEnviado[]
  linkMontagem: string
  nomeEstabelecimento?: string
}): string {
  const { visitante, itens, linkMontagem, nomeEstabelecimento } = params
  const titulo = nomeEstabelecimento
    ? `Nova montagem — ${nomeEstabelecimento}`
    : 'Nova montagem de mesa'

  const linhasItens =
    itens.length === 0
      ? '- (nenhum item)'
      : itens.map((i) => `- ${i.categoria}: ${i.nome}`).join('\n')

  return [
    titulo,
    '',
    `Nome: ${visitante.nome}`,
    `E-mail: ${visitante.email}`,
    `WhatsApp: ${visitante.whatsapp}`,
    `Endereço: ${visitante.endereco}`,
    `Cidade: ${visitante.cidade}`,
    `Estado: ${visitante.estado}`,
    '',
    'Itens:',
    linhasItens,
    '',
    `Link: ${linkMontagem}`,
  ].join('\n')
}

export function urlWhatsAppMontagem(
  whatsappAdminDigitos: string,
  texto: string,
): string {
  const digitos = whatsappAdminDigitos.replace(/\D/g, '')
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`
}
