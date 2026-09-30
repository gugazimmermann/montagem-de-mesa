-- Signed-in users can still call SECURITY DEFINER functions in public
-- via /rest/v1/rpc. Privileged bodies move to privado. Public names
-- stay SECURITY INVOKER so the admin app keeps the same RPCs.

create schema if not exists privado;

revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileged bodies
-- ---------------------------------------------------------------------------

create or replace function privado.cliente_slug_em_uso_exceto(
  p_slug text,
  p_cliente_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clientes
    where slug = trim(p_slug)
      and id <> p_cliente_id
  );
$$;

create or replace function privado.proximo_ordem_categoria(p_cliente_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(ordem), -1) + 1
  from public.categorias
  where cliente_id = p_cliente_id
    and deleted_at is null;
$$;

create or replace function privado.proximo_ordem_item(
  p_cliente_id uuid,
  p_categoria_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(ordem), -1) + 1
  from public.itens
  where cliente_id = p_cliente_id
    and categoria_id = p_categoria_id
    and deleted_at is null;
$$;

create or replace function privado.trocar_ordem_categoria(
  p_cliente_id uuid,
  p_id_a uuid,
  p_id_b uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ordem_a int;
  v_ordem_b int;
begin
  if not privado.eh_dono_cliente(p_cliente_id) then
    raise exception 'Sem permissão';
  end if;
  if not privado.cliente_tem_acesso(p_cliente_id) then
    raise exception 'Sem acesso';
  end if;

  select ordem into v_ordem_a
  from public.categorias
  where cliente_id = p_cliente_id and id = p_id_a and deleted_at is null
  for update;
  select ordem into v_ordem_b
  from public.categorias
  where cliente_id = p_cliente_id and id = p_id_b and deleted_at is null
  for update;

  if v_ordem_a is null or v_ordem_b is null then
    raise exception 'Categoria não encontrada';
  end if;

  update public.categorias
  set ordem = case id
    when p_id_a then v_ordem_b
    when p_id_b then v_ordem_a
  end
  where cliente_id = p_cliente_id and id in (p_id_a, p_id_b);
end;
$$;

create or replace function privado.trocar_ordem_item(
  p_cliente_id uuid,
  p_categoria_id uuid,
  p_id_a uuid,
  p_id_b uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ordem_a int;
  v_ordem_b int;
begin
  if not privado.eh_dono_cliente(p_cliente_id) then
    raise exception 'Sem permissão';
  end if;
  if not privado.cliente_tem_acesso(p_cliente_id) then
    raise exception 'Sem acesso';
  end if;

  select ordem into v_ordem_a
  from public.itens
  where cliente_id = p_cliente_id
    and categoria_id = p_categoria_id
    and id = p_id_a
    and deleted_at is null
  for update;
  select ordem into v_ordem_b
  from public.itens
  where cliente_id = p_cliente_id
    and categoria_id = p_categoria_id
    and id = p_id_b
    and deleted_at is null
  for update;

  if v_ordem_a is null or v_ordem_b is null then
    raise exception 'Item não encontrado';
  end if;

  update public.itens
  set ordem = case id
    when p_id_a then v_ordem_b
    when p_id_b then v_ordem_a
  end
  where cliente_id = p_cliente_id and id in (p_id_a, p_id_b);
end;
$$;

create or replace function privado.sincronizar_email_cliente_do_auth()
returns public.clientes
language plpgsql
security definer
set search_path = public
as $$
declare
  row_cliente public.clientes;
  email_auth text;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  select lower(u.email::text)
    into email_auth
  from auth.users u
  where u.id = auth.uid();

  if email_auth is null or email_auth = '' then
    raise exception 'Usuário Auth sem e-mail';
  end if;

  update public.clientes
  set
    email = email_auth,
    updated_at = now()
  where auth_user_id = auth.uid()
  returning * into row_cliente;

  return row_cliente;
end;
$$;

create or replace function privado.proteger_clientes_colunas_sensiveis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_auth text;
  eh_service boolean;
begin
  eh_service := coalesce(auth.jwt() ->> 'role', '') = 'service_role';

  if tg_op = 'INSERT' then
    if not eh_service then
      new.stripe_customer_id := null;
      new.stripe_subscription_id := null;
      new.subscription_status := 'trialing';
      new.trial_ends_at := now() + interval '14 days';
      new.current_period_end := null;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Coluna id de clientes é imutável';
    end if;

    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Coluna auth_user_id de clientes é imutável';
    end if;

    if not eh_service then
      new.stripe_customer_id := old.stripe_customer_id;
      new.stripe_subscription_id := old.stripe_subscription_id;
      new.subscription_status := old.subscription_status;
      new.trial_ends_at := old.trial_ends_at;
      new.current_period_end := old.current_period_end;
    end if;

    if new.email is distinct from old.email then
      if auth.uid() is null or auth.uid() is distinct from old.auth_user_id then
        raise exception 'E-mail de clientes só pode ser sincronizado pelo dono autenticado';
      end if;

      select lower(u.email::text)
        into email_auth
      from auth.users u
      where u.id = auth.uid();

      if email_auth is null
         or lower(trim(new.email)) is distinct from email_auth then
        raise exception 'E-mail de clientes deve coincidir com auth.users';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function privado.cliente_slug_em_uso_exceto(text, uuid) from public;
revoke all on function privado.proximo_ordem_categoria(uuid) from public;
revoke all on function privado.proximo_ordem_item(uuid, uuid) from public;
revoke all on function privado.trocar_ordem_categoria(uuid, uuid, uuid) from public;
revoke all on function privado.trocar_ordem_item(uuid, uuid, uuid, uuid) from public;
revoke all on function privado.sincronizar_email_cliente_do_auth() from public;
revoke all on function privado.proteger_clientes_colunas_sensiveis() from public;

grant execute on function privado.cliente_slug_em_uso_exceto(text, uuid) to authenticated, service_role;
grant execute on function privado.proximo_ordem_categoria(uuid) to authenticated, service_role;
grant execute on function privado.proximo_ordem_item(uuid, uuid) to authenticated, service_role;
grant execute on function privado.trocar_ordem_categoria(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function privado.trocar_ordem_item(uuid, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function privado.sincronizar_email_cliente_do_auth() to authenticated, service_role;
grant execute on function privado.proteger_clientes_colunas_sensiveis() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------

create or replace function public.cliente_slug_em_uso_exceto(
  p_slug text,
  p_cliente_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select privado.cliente_slug_em_uso_exceto(p_slug, p_cliente_id);
$$;

create or replace function public.proximo_ordem_categoria(p_cliente_id uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select privado.proximo_ordem_categoria(p_cliente_id);
$$;

create or replace function public.proximo_ordem_item(
  p_cliente_id uuid,
  p_categoria_id uuid
)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select privado.proximo_ordem_item(p_cliente_id, p_categoria_id);
$$;

create or replace function public.trocar_ordem_categoria(
  p_cliente_id uuid,
  p_id_a uuid,
  p_id_b uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform privado.trocar_ordem_categoria(p_cliente_id, p_id_a, p_id_b);
end;
$$;

create or replace function public.trocar_ordem_item(
  p_cliente_id uuid,
  p_categoria_id uuid,
  p_id_a uuid,
  p_id_b uuid
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform privado.trocar_ordem_item(p_cliente_id, p_categoria_id, p_id_a, p_id_b);
end;
$$;

create or replace function public.sincronizar_email_cliente_do_auth()
returns public.clientes
language sql
volatile
security invoker
set search_path = public
as $$
  select privado.sincronizar_email_cliente_do_auth();
$$;

revoke all on function public.cliente_slug_em_uso_exceto(text, uuid) from public, anon;
revoke all on function public.proximo_ordem_categoria(uuid) from public, anon;
revoke all on function public.proximo_ordem_item(uuid, uuid) from public, anon;
revoke all on function public.trocar_ordem_categoria(uuid, uuid, uuid) from public, anon;
revoke all on function public.trocar_ordem_item(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.sincronizar_email_cliente_do_auth() from public, anon;

grant execute on function public.cliente_slug_em_uso_exceto(text, uuid) to authenticated;
grant execute on function public.proximo_ordem_categoria(uuid) to authenticated;
grant execute on function public.proximo_ordem_item(uuid, uuid) to authenticated;
grant execute on function public.trocar_ordem_categoria(uuid, uuid, uuid) to authenticated;
grant execute on function public.trocar_ordem_item(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.sincronizar_email_cliente_do_auth() to authenticated;

-- Trigger stays definer, but outside the exposed API schema.
drop trigger if exists trg_proteger_clientes_sensiveis on public.clientes;
create trigger trg_proteger_clientes_sensiveis
  before insert or update on public.clientes
  for each row
  execute function privado.proteger_clientes_colunas_sensiveis();

drop function if exists public.proteger_clientes_colunas_sensiveis();

-- ---------------------------------------------------------------------------
-- Any SECURITY DEFINER still in public is not a signed-in API.
-- Keep service_role only when it already had EXECUTE.
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
  service_had boolean;
begin
  for fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prosecdef
  loop
    service_had := has_function_privilege('service_role', fn.oid, 'execute');

    execute format('revoke all on function %s from public', fn.oid::regprocedure);
    execute format('revoke all on function %s from anon', fn.oid::regprocedure);
    execute format('revoke all on function %s from authenticated', fn.oid::regprocedure);

    if service_had then
      execute format(
        'grant execute on function %s to service_role',
        fn.oid::regprocedure
      );
    end if;
  end loop;
end;
$$;
