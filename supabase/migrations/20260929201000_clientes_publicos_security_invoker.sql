-- View pública deixa de ser SECURITY DEFINER (lint 0010).
-- A leitura filtrada fica numa função SECURITY DEFINER com search_path fixo,
-- fora do schema exposto pela API. A view só encaminha o usuário chamador.

create schema if not exists privado;

revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated;

create or replace function privado.clientes_publicos_visiveis()
returns table (
  id uuid,
  slug text,
  nome text,
  logo text,
  whatsapp text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.nome, c.logo, c.whatsapp
  from public.clientes c
  where public.cliente_tem_acesso(c.id);
$$;

revoke all on function privado.clientes_publicos_visiveis() from public;
grant execute on function privado.clientes_publicos_visiveis() to anon, authenticated;

create or replace view public.clientes_publicos
with (security_invoker = true) as
  select id, slug, nome, logo, whatsapp
  from privado.clientes_publicos_visiveis();

alter view public.clientes_publicos set (security_invoker = true);

grant select on public.clientes_publicos to anon, authenticated;
