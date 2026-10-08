-- Catálogo e diretório público deixam de ser listáveis pela anon key.
-- A página da loja continua em carregar_catalogo_publico (slug obrigatório).
-- Lookup pontual: obter_cliente_publico (slug ou id, no máximo uma linha).
-- Policies de storage do outro projeto (food-photos / doctor_patients) não mudam.

-- ---------------------------------------------------------------------------
-- 1. Categorias e itens: só o dono autenticado, e só linhas ativas
-- ---------------------------------------------------------------------------

drop policy if exists categorias_select_public on public.categorias;
drop policy if exists categorias_select_own on public.categorias;

create policy categorias_select_own
  on public.categorias
  for select
  to authenticated
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
    and deleted_at is null
  );

drop policy if exists itens_select_public on public.itens;
drop policy if exists itens_select_own on public.itens;

create policy itens_select_own
  on public.itens
  for select
  to authenticated
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
    and deleted_at is null
  );

-- ---------------------------------------------------------------------------
-- 2. Uma loja por chamada, em vez de select na view inteira
-- ---------------------------------------------------------------------------

create or replace function privado.obter_cliente_publico(
  p_slug text default null,
  p_id uuid default null
)
returns table (
  id uuid,
  slug text,
  nome text,
  logo text,
  whatsapp text,
  cor_marca text,
  cor_fundo text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.nome, c.logo, c.whatsapp, c.cor_marca, c.cor_fundo
  from public.clientes c
  where public.cliente_tem_acesso(c.id)
    and (
      (nullif(trim(p_slug), '') is not null and c.slug = trim(p_slug))
      or (p_id is not null and c.id = p_id)
    )
  limit 1;
$$;

revoke all on function privado.obter_cliente_publico(text, uuid) from public;
grant execute on function privado.obter_cliente_publico(text, uuid) to anon, authenticated, service_role;

create or replace function public.obter_cliente_publico(
  p_slug text default null,
  p_id uuid default null
)
returns table (
  id uuid,
  slug text,
  nome text,
  logo text,
  whatsapp text,
  cor_marca text,
  cor_fundo text
)
language sql
stable
security invoker
set search_path = public
as $$
  select id, slug, nome, logo, whatsapp, cor_marca, cor_fundo
  from privado.obter_cliente_publico(p_slug, p_id);
$$;

revoke all on function public.obter_cliente_publico(text, uuid) from public;
grant execute on function public.obter_cliente_publico(text, uuid) to anon, authenticated;

revoke select on public.clientes_publicos from anon, authenticated;
revoke execute on function privado.clientes_publicos_visiveis() from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Lead: sessão sem usuário não é service role
-- ---------------------------------------------------------------------------

create or replace function public.proteger_montagens_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  eh_service boolean;
begin
  eh_service :=
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin', 'service_role');

  if eh_service then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.cliente_id is distinct from old.cliente_id
    or new.visitante_nome is distinct from old.visitante_nome
    or new.visitante_email is distinct from old.visitante_email
    or new.visitante_whatsapp is distinct from old.visitante_whatsapp
    or new.visitante_endereco is distinct from old.visitante_endereco
    or new.visitante_cidade is distinct from old.visitante_cidade
    or new.visitante_estado is distinct from old.visitante_estado
    or new.itens is distinct from old.itens
    or new.link_montagem is distinct from old.link_montagem
    or new.created_at is distinct from old.created_at
    or new.email_status is distinct from old.email_status
    or new.idempotency_key is distinct from old.idempotency_key
  then
    raise exception 'Atualização permitida apenas em lead_status e nota_interna';
  end if;
  return new;
end;
$$;
