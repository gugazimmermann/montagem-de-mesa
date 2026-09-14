import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { siteUrl } from '../_shared/stripe.ts'
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
  idempotencyKey?: unknown
}

const MAX_ITENS = 40
const MAX_LINK = 2000
const RATE_LIMIT = 5
const RATE_JANELA_SEG = 60
/** `m` = uuid:uuid|uuid:uuid… */
const RE_PARAM_M = /^[0-9a-fA-F|:.-]{1,1500}$/

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

function ipDoRequest(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return 'unknown'
}

/** Sempre usa SITE_URL; só reaproveita `?m=` do cliente se for seguro. */
function montarLinkMontagem(slug: string, linkCliente: string | null): string | null {
  let base: string
  try {
    base = siteUrl()
  } catch {
    return null
  }

  let m: string | null = null
  if (linkCliente) {
    try {
      const u = new URL(linkCliente)
      const bruto = u.searchParams.get('m')
      if (bruto && RE_PARAM_M.test(bruto)) m = bruto
    } catch {
      // ignora link inválido; ainda montamos o canônico sem m
    }
  }

  const out = new URL(`/${slug}`, `${base}/`)
  if (m) out.searchParams.set('m', m)
  const href = out.toString()
  return href.length <= MAX_LINK ? href : null
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
    const linkCliente = texto(body.linkMontagem, MAX_LINK)
    const idempotencyKey = texto(body.idempotencyKey, 80)
    const v = body.visitante ?? {}

    const nome = texto(v.nome, 120)
    const email = texto(v.email, 200)?.toLowerCase()
    const whatsapp = texto(v.whatsapp, 20)
    const endereco = texto(v.endereco, 200)
    const cidade = texto(v.cidade, 100)
    const estado = texto(v.estado, 2)?.toUpperCase()

    if (!slug || !nome || !email || !whatsapp || !endereco || !cidade || !estado) {
      return jsonResponse({ error: 'Dados incompletos ou inválidos.' }, 400)
    }

    const linkMontagem = montarLinkMontagem(slug, linkCliente)
    if (!linkMontagem) {
      return jsonResponse({ error: 'Link da montagem inválido.' }, 400)
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'E-mail do visitante inválido.' }, 400)
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
    const ip = ipDoRequest(req)

    const { data: rateOk, error: rateError } = await admin.rpc('verificar_rate_limit', {
      p_chave: `enviar-montagem:${slug}:${ip}`,
      p_limite: RATE_LIMIT,
      p_janela_segundos: RATE_JANELA_SEG,
    })

    if (rateError) {
      console.error('enviar-montagem rate', rateError)
      return jsonResponse({ error: 'Não foi possível processar o envio.' }, 500)
    }

    if (!rateOk) {
      return jsonResponse(
        { error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' },
        429,
      )
    }

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

    if (idempotencyKey) {
      const { data: existente } = await admin
        .from('montagens_enviadas')
        .select(
          'id, email_status, visitante_nome, visitante_email, visitante_whatsapp, visitante_endereco, visitante_cidade, visitante_estado, itens, link_montagem',
        )
        .eq('cliente_id', cliente.id)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle()

      if (existente?.email_status === 'sent') {
        return jsonResponse({ ok: true, deduplicated: true })
      }

      // Retry só com dados já persistidos — nunca com o body do request atual.
      if (existente && existente.email_status !== 'sent') {
        const itensDb = Array.isArray(existente.itens)
          ? (existente.itens as { categoria: string; nome: string }[])
          : []
        const reenviado = await enviarEmailEAtualizar({
          admin,
          montagemId: existente.id,
          clienteEmail: cliente.email,
          clienteNome: cliente.nome,
          nome: String(existente.visitante_nome ?? ''),
          email: String(existente.visitante_email ?? ''),
          whatsapp: String(existente.visitante_whatsapp ?? ''),
          endereco: String(existente.visitante_endereco ?? ''),
          cidade: String(existente.visitante_cidade ?? ''),
          estado: String(existente.visitante_estado ?? ''),
          itens: itensDb,
          linkMontagem: String(existente.link_montagem ?? ''),
        })
        if (!reenviado) {
          return jsonResponse({ error: 'Falha ao enviar o e-mail. Tente novamente.' }, 502)
        }
        return jsonResponse({ ok: true })
      }
    }

    const { data: inserida, error: insertError } = await admin
      .from('montagens_enviadas')
      .insert({
        cliente_id: cliente.id,
        visitante_nome: nome,
        visitante_email: email,
        visitante_whatsapp: whatsapp,
        visitante_endereco: endereco,
        visitante_cidade: cidade,
        visitante_estado: estado,
        itens,
        link_montagem: linkMontagem,
        email_status: 'pending',
        idempotency_key: idempotencyKey ?? null,
      })
      .select('id')
      .single()

    if (insertError) {
      if (insertError.code === '23505' && idempotencyKey) {
        return jsonResponse({ ok: true, deduplicated: true })
      }
      console.error('enviar-montagem insert', insertError)
      return jsonResponse({ error: 'Não foi possível salvar a montagem.' }, 500)
    }

    const enviado = await enviarEmailEAtualizar({
      admin,
      montagemId: inserida.id,
      clienteEmail: cliente.email,
      clienteNome: cliente.nome,
      nome,
      email,
      whatsapp,
      endereco,
      cidade,
      estado,
      itens,
      linkMontagem,
    })

    if (!enviado) {
      return jsonResponse({ error: 'Falha ao enviar o e-mail. Tente novamente.' }, 502)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('enviar-montagem', err)
    return jsonResponse({ error: 'Erro interno' }, 500)
  }
})

type AdminClient = ReturnType<typeof supabaseAdmin>

async function enviarEmailEAtualizar(args: {
  admin: AdminClient
  montagemId: string
  clienteEmail: string
  clienteNome: string
  nome: string
  email: string
  whatsapp: string
  endereco: string
  cidade: string
  estado: string
  itens: { categoria: string; nome: string }[]
  linkMontagem: string
}): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const resendFrom =
    Deno.env.get('RESEND_FROM') ?? 'Montagem de Mesa <onboarding@resend.dev>'

  if (!resendKey) {
    console.error('RESEND_API_KEY ausente')
    await args.admin
      .from('montagens_enviadas')
      .update({ email_status: 'failed' })
      .eq('id', args.montagemId)
    return false
  }

  const linhasItens = args.itens.map((i) => `- ${i.categoria}: ${i.nome}`).join('\n')
  const textoPlano = [
    `Nova montagem — ${args.clienteNome}`,
    '',
    `Nome: ${args.nome}`,
    `E-mail: ${args.email}`,
    `WhatsApp: ${args.whatsapp}`,
    `Endereço: ${args.endereco}`,
    `Cidade: ${args.cidade}`,
    `Estado: ${args.estado}`,
    '',
    'Itens:',
    linhasItens,
    '',
    `Link: ${args.linkMontagem}`,
  ].join('\n')

  const itensHtml = args.itens
    .map(
      (i) =>
        `<li><strong>${escaparHtml(i.categoria)}:</strong> ${escaparHtml(i.nome)}</li>`,
    )
    .join('')

  const html = `
      <h2>Nova montagem — ${escaparHtml(args.clienteNome)}</h2>
      <p><strong>Nome:</strong> ${escaparHtml(args.nome)}<br/>
      <strong>E-mail:</strong> ${escaparHtml(args.email)}<br/>
      <strong>WhatsApp:</strong> ${escaparHtml(args.whatsapp)}<br/>
      <strong>Endereço:</strong> ${escaparHtml(args.endereco)}<br/>
      <strong>Cidade:</strong> ${escaparHtml(args.cidade)}<br/>
      <strong>Estado:</strong> ${escaparHtml(args.estado)}</p>
      <h3>Itens</h3>
      <ul>${itensHtml}</ul>
      <p><strong>Link:</strong> <a href="${escaparHtml(args.linkMontagem)}">${escaparHtml(args.linkMontagem)}</a></p>
    `

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [args.clienteEmail],
      subject: `Nova montagem — ${args.nome}`,
      text: textoPlano,
      html,
      reply_to: args.email,
    }),
  })

  if (!resendRes.ok) {
    const detalhe = await resendRes.text()
    console.error('Resend falhou', resendRes.status, detalhe)
    await args.admin
      .from('montagens_enviadas')
      .update({ email_status: 'failed' })
      .eq('id', args.montagemId)
    return false
  }

  await args.admin
    .from('montagens_enviadas')
    .update({ email_status: 'sent' })
    .eq('id', args.montagemId)

  return true
}
