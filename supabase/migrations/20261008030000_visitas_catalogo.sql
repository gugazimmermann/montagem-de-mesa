-- Contagem diária de aberturas da página pública (fuso de São Paulo).
-- O visitante só incrementa via RPC; a loja lê as próprias linhas.

create table if not exists public.visitas_catalogo_dia (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  dia date not null,
  total integer not null default 0 check (total >= 0),
  primary key (cliente_id, dia)
);

alter table public.visitas_catalogo_dia enable row level security;

drop policy if exists visitas_catalogo_dia_select_own on public.visitas_catalogo_dia;

create policy visitas_catalogo_dia_select_own
  on public.visitas_catalogo_dia
  for select
  to authenticated
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

revoke all on table public.visitas_catalogo_dia from public, anon;
grant select on table public.visitas_catalogo_dia to authenticated;

create or replace function privado.registrar_visita_catalogo(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_dia date;
begin
  if p_slug is null or length(trim(p_slug)) = 0 or length(trim(p_slug)) > 80 then
    return;
  end if;

  select c.id
    into v_id
  from public.clientes c
  where c.slug = trim(p_slug)
    and public.cliente_tem_acesso(c.id)
  limit 1;

  if v_id is null then
    return;
  end if;

  v_dia := (timezone('America/Sao_Paulo', now()))::date;

  insert into public.visitas_catalogo_dia (cliente_id, dia, total)
  values (v_id, v_dia, 1)
  on conflict (cliente_id, dia)
  do update set total = public.visitas_catalogo_dia.total + 1;
end;
$$;

create or replace function public.registrar_visita_catalogo(p_slug text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform privado.registrar_visita_catalogo(p_slug);
end;
$$;

revoke all on function privado.registrar_visita_catalogo(text) from public;
grant execute on function privado.registrar_visita_catalogo(text) to anon, authenticated, service_role;

revoke all on function public.registrar_visita_catalogo(text) from public;
grant execute on function public.registrar_visita_catalogo(text) to anon, authenticated;
