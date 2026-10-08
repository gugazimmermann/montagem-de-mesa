import { siteUrl } from '../_shared/stripe.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

function escapar(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function ehRobo(userAgent: string): boolean {
  return /facebookexternalhit|Facebot|WhatsApp|Twitterbot|Slackbot|LinkedInBot|Discordbot|TelegramBot|googlebot|bingbot|embedly|pinterest/i.test(
    userAgent,
  )
}

function htmlLoja(opcoes: {
  nome: string
  descricao: string
  url: string
  imagem?: string
}): string {
  const imagem = opcoes.imagem
    ? `<meta property="og:image" content="${escapar(opcoes.imagem)}" />`
    : ''
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escapar(opcoes.nome)} · Montagem de Mesa</title>
  <meta name="description" content="${escapar(opcoes.descricao)}" />
  <meta property="og:title" content="${escapar(opcoes.nome)}" />
  <meta property="og:description" content="${escapar(opcoes.descricao)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapar(opcoes.url)}" />
  ${imagem}
  <meta http-equiv="refresh" content="0; url=${escapar(opcoes.url)}" />
</head>
<body>
  <p><a href="${escapar(opcoes.url)}">${escapar(opcoes.nome)}</a></p>
</body>
</html>`
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const slug = (url.searchParams.get('slug') ?? '').trim()
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return new Response('Não encontrado', { status: 404 })
  }

  let destino = `/${slug}`
  try {
    destino = `${siteUrl()}/${slug}`
  } catch {
    destino = `/${slug}`
  }

  const robo = ehRobo(req.headers.get('user-agent') ?? '')
  if (!robo) {
    return Response.redirect(destino, 302)
  }

  const admin = supabaseAdmin()
  const { data: cliente } = await admin
    .from('clientes')
    .select('nome, logo')
    .eq('slug', slug)
    .maybeSingle()

  if (!cliente) return new Response('Não encontrado', { status: 404 })

  const nome = typeof cliente.nome === 'string' && cliente.nome.trim()
    ? cliente.nome.trim()
    : 'Montagem de Mesa'
  let imagem: string | undefined
  const logo = typeof cliente.logo === 'string' ? cliente.logo.trim() : ''
  if (logo && !/^https?:\/\//i.test(logo)) {
    const assinado = await admin.storage.from('logos').createSignedUrl(logo, 60 * 60)
    imagem = assinado.data?.signedUrl
  } else if (logo) {
    imagem = logo
  }

  return new Response(
    htmlLoja({
      nome,
      descricao: `Monte o lugar à mesa de ${nome}.`,
      url: destino,
      imagem,
    }),
    {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    },
  )
})
