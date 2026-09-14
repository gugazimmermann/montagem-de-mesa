import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

type Visitante = {
  nome?: unknown
  email?: unknown
  whatsapp?: unknown
  endereco?: unknown
  cidade?: unknown
  estado?: unknown
}

type Item = {
  categoria?: unknown
  nome?: unknown
}

type Body = {
  slug?: unknown
  visitante?: Visitante
  itens?: unknown
  linkMontagem?: unknown
}

const MAX_ITENS = 40
const MAX_LINK = 2000

function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null
  const t = valor.trim()
  if (!t || t.length > max) return null
  return t
}

function escaparHtml(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405)
  }

  try {
    let body: Body
    try {
      body = (await req.json()) as Body
    } catch {
      return jsonResponse({ error: 'JSON inválido' }, 400)
    }

    const slug = texto(body.slug, 80)?.toLowerCase()
    const linkMontagem = texto(body.linkMontagem, MAX_LINK)
    const v = body.visitante ?? {}

    const nome = texto(v.nome, 120)
    const email = texto(v.email, 200)?.toLowerCase()
    const whatsapp = texto(v.whatsapp, 20)
    const endereco = texto(v.endereco, 200)
    const cidade = texto(v.cidade, 100)
    const estado = texto(v.estado, 2)?.toUpperCase()

    if (!slug || !linkMontagem || !nome || !email || !whatsapp || !endereco || !cidade || !estado) {
      return jsonResponse({ error: 'Dados incompletos ou inválidos.' }, 400)
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'E-mail do visitante inválido.' }, 400)
    }

    if (!/^https?:\/\//i.test(linkMontagem)) {
      return jsonResponse({ error: 'Link da montagem inválido.' }, 400)
    }

    if (!Array.isArray(body.itens) || body.itens.length === 0) {
      return jsonResponse({ error: 'Informe os itens da montagem.' }, 400)
    }

    if (body.itens.length > MAX_ITENS) {
      return jsonResponse({ error: 'Muitos itens na montagem.' }, 400)
    }

    const itens: { categoria: string; nome: string }[] = []
    for (const raw of body.itens as Item[]) {
      const categoria = texto(raw?.categoria, 120)
      const nomeItem = texto(raw?.nome, 200)
      if (!categoria || !nomeItem) {
        return jsonResponse({ error: 'Item da montagem inválido.' }, 400)
      }
      itens.push({ categoria, nome: nomeItem })
    }

    const admin = supabaseAdmin()

    const { data: cliente, error: clienteError } = await admin
      .from('clientes')
      .select('id, email, nome')
      .eq('slug', slug)
      .maybeSingle()

    if (clienteError) {
      console.error('enviar-montagem cliente', clienteError)
      return jsonResponse({ error: 'Não foi possível localizar o estabelecimento.' }, 500)
    }

    if (!cliente?.email) {
      return jsonResponse({ error: 'Estabelecimento não encontrado.' }, 404)
    }

    const { data: temAcesso, error: acessoError } = await admin.rpc('cliente_tem_acesso', {
      p_cliente_id: cliente.id,
    })

    if (acessoError) {
      console.error('enviar-montagem acesso', acessoError)
      return jsonResponse({ error: 'Não foi possível validar o estabelecimento.' }, 500)
    }

    if (!temAcesso) {
      return jsonResponse({ error: 'Montagem indisponível para este endereço.' }, 404)
    }

    const { error: insertError } = await admin.from('montagens_enviadas').insert({
      cliente_id: cliente.id,
      visitante_nome: nome,
      visitante_email: email,
      visitante_whatsapp: whatsapp,
      visitante_endereco: endereco,
      visitante_cidade: cidade,
      visitante_estado: estado,
      itens,
      link_montagem: linkMontagem,
    })

    if (insertError) {
      console.error('enviar-montagem insert', insertError)
      return jsonResponse({ error: 'Não foi possível salvar a montagem.' }, 500)
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const resendFrom =
      Deno.env.get('RESEND_FROM') ?? 'Montagem de Mesa <onboarding@resend.dev>'

    if (!resendKey) {
      console.error('RESEND_API_KEY ausente')
      return jsonResponse({ error: 'Envio de e-mail não configurado.' }, 500)
    }

    const linhasItens = itens.map((i) => `- ${i.categoria}: ${i.nome}`).join('\n')
    const textoPlano = [
      `Nova montagem — ${cliente.nome}`,
      '',
      `Nome: ${nome}`,
      `E-mail: ${email}`,
      `WhatsApp: ${whatsapp}`,
      `Endereço: ${endereco}`,
      `Cidade: ${cidade}`,
      `Estado: ${estado}`,
      '',
      'Itens:',
      linhasItens,
      '',
      `Link: ${linkMontagem}`,
    ].join('\n')

    const itensHtml = itens
      .map(
        (i) =>
          `<li><strong>${escaparHtml(i.categoria)}:</strong> ${escaparHtml(i.nome)}</li>`,
      )
      .join('')

    const html = `
      <h2>Nova montagem — ${escaparHtml(cliente.nome)}</h2>
      <p><strong>Nome:</strong> ${escaparHtml(nome)}<br/>
      <strong>E-mail:</strong> ${escaparHtml(email)}<br/>
      <strong>WhatsApp:</strong> ${escaparHtml(whatsapp)}<br/>
      <strong>Endereço:</strong> ${escaparHtml(endereco)}<br/>
      <strong>Cidade:</strong> ${escaparHtml(cidade)}<br/>
      <strong>Estado:</strong> ${escaparHtml(estado)}</p>
      <h3>Itens</h3>
      <ul>${itensHtml}</ul>
      <p><strong>Link:</strong> <a href="${escaparHtml(linkMontagem)}">${escaparHtml(linkMontagem)}</a></p>
    `

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [cliente.email],
        subject: `Nova montagem — ${nome}`,
        text: textoPlano,
        html,
        reply_to: email,
      }),
    })

    if (!resendRes.ok) {
      const detalhe = await resendRes.text()
      console.error('Resend falhou', resendRes.status, detalhe)
      return jsonResponse({ error: 'Falha ao enviar o e-mail. Tente novamente.' }, 502)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('enviar-montagem', err)
    const message = err instanceof Error ? err.message : 'Erro interno'
    return jsonResponse({ error: message }, 500)
  }
})
