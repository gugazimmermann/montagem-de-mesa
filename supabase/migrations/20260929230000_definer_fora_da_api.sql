-- SECURITY DEFINER in public is callable by anon as /rest/v1/rpc.
-- The privileged body moves to privado (not an exposed API schema).
-- The public name stays SECURITY INVOKER so policies and the app keep working.

create schema if not exists privado;

revoke all on schema privado from public;
grant usage on schema privado to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileged bodies
-- ---------------------------------------------------------------------------

create or replace function privado.cliente_tem_acesso(p_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clientes c
    where c.id = p_cliente_id
      and (
        (
          c.subscription_status = 'trialing'
          and c.trial_ends_at is not null
          and c.trial_ends_at > now()
        )
        or (
          c.subscription_status = 'active'
          and c.current_period_end is not null
          and c.current_period_end > now()
        )
        or (
          c.subscription_status = 'past_due'
          and c.current_period_end is not null
          and c.current_period_end + interval '7 days' > now()
        )
      )
  );
$$;

create or replace function privado.eh_dono_cliente(p_cliente_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clientes
    where id = p_cliente_id
      and auth_user_id = auth.uid()
  );
$$;

create or replace function privado.status_cliente_publico(p_slug text)
returns table (
  existe boolean,
  tem_acesso boolean,
  nome text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    true as existe,
    privado.cliente_tem_acesso(c.id) as tem_acesso,
    c.nome
  from public.clientes c
  where c.slug = trim(p_slug)
  limit 1;
$$;

create or replace function privado.carregar_catalogo_publico(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cliente public.clientes%rowtype;
  v_tem_acesso boolean;
begin
  select * into v_cliente
  from public.clientes c
  where c.slug = trim(p_slug)
  limit 1;

  if not found then
    return jsonb_build_object(
      'existe', false,
      'tem_acesso', false,
      'nome', null,
      'cliente', null,
      'categorias', '[]'::jsonb,
      'itens', '[]'::jsonb
    );
  end if;

  v_tem_acesso := privado.cliente_tem_acesso(v_cliente.id);

  if not v_tem_acesso then
    return jsonb_build_object(
      'existe', true,
      'tem_acesso', false,
      'nome', v_cliente.nome,
      'cliente', jsonb_build_object(
        'id', v_cliente.id,
        'slug', v_cliente.slug,
        'nome', v_cliente.nome,
        'logo', v_cliente.logo,
        'whatsapp', v_cliente.whatsapp,
        'email', v_cliente.email
      ),
      'categorias', '[]'::jsonb,
      'itens', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'existe', true,
    'tem_acesso', true,
    'nome', v_cliente.nome,
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'slug', v_cliente.slug,
      'nome', v_cliente.nome,
      'logo', v_cliente.logo,
      'whatsapp', v_cliente.whatsapp,
      'email', v_cliente.email
    ),
    'categorias', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', cat.id,
            'codigo', cat.codigo,
            'rotulo', cat.rotulo,
            'descricao', cat.descricao,
            'ordem', cat.ordem
          )
          order by cat.ordem, cat.rotulo
        )
        from public.categorias cat
        where cat.cliente_id = v_cliente.id
          and cat.deleted_at is null
      ),
      '[]'::jsonb
    ),
    'itens', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'categoria_id', i.categoria_id,
            'nome', i.nome,
            'imagem', i.imagem,
            'cores', i.cores,
            'largura', i.largura,
            'comprimento', i.comprimento,
            'padrao', i.padrao,
            'descricao', i.descricao,
            'ordem', i.ordem
          )
          order by i.ordem, i.nome
        )
        from public.itens i
        where i.cliente_id = v_cliente.id
          and i.deleted_at is null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create or replace function privado.cliente_slug_em_uso(p_slug text)
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
  );
$$;

revoke all on function privado.cliente_tem_acesso(uuid) from public;
revoke all on function privado.eh_dono_cliente(uuid) from public;
revoke all on function privado.status_cliente_publico(text) from public;
revoke all on function privado.carregar_catalogo_publico(text) from public;
revoke all on function privado.cliente_slug_em_uso(text) from public;

grant execute on function privado.cliente_tem_acesso(uuid) to anon, authenticated, service_role;
grant execute on function privado.eh_dono_cliente(uuid) to anon, authenticated, service_role;
grant execute on function privado.status_cliente_publico(text) to anon, authenticated, service_role;
grant execute on function privado.carregar_catalogo_publico(text) to anon, authenticated, service_role;
grant execute on function privado.cliente_slug_em_uso(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Public wrappers (same names and arguments the app and policies call)
-- ---------------------------------------------------------------------------

create or replace function public.cliente_tem_acesso(p_cliente_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select privado.cliente_tem_acesso(p_cliente_id);
$$;

create or replace function public.eh_dono_cliente(p_cliente_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select privado.eh_dono_cliente(p_cliente_id);
$$;

create or replace function public.status_cliente_publico(p_slug text)
returns table (
  existe boolean,
  tem_acesso boolean,
  nome text
)
language sql
stable
security invoker
set search_path = public
as $$
  select existe, tem_acesso, nome
  from privado.status_cliente_publico(p_slug);
$$;

create or replace function public.carregar_catalogo_publico(p_slug text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select privado.carregar_catalogo_publico(p_slug);
$$;

create or replace function public.cliente_slug_em_uso(p_slug text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select privado.cliente_slug_em_uso(p_slug);
$$;

revoke all on function public.cliente_tem_acesso(uuid) from public;
revoke all on function public.eh_dono_cliente(uuid) from public;
revoke all on function public.status_cliente_publico(text) from public;
revoke all on function public.carregar_catalogo_publico(text) from public;
revoke all on function public.cliente_slug_em_uso(text) from public;

grant execute on function public.cliente_tem_acesso(uuid) to anon, authenticated;
grant execute on function public.eh_dono_cliente(uuid) to anon, authenticated;
grant execute on function public.status_cliente_publico(text) to anon, authenticated;
grant execute on function public.carregar_catalogo_publico(text) to anon, authenticated;
grant execute on function public.cliente_slug_em_uso(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Remaining public SECURITY DEFINER functions are not anonymous APIs.
-- Revoke anon and PUBLIC. Put back authenticated / service_role only when
-- they already had EXECUTE (including through PUBLIC).
-- ---------------------------------------------------------------------------

do $$
declare
  fn record;
  authenticated_had boolean;
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
    authenticated_had := has_function_privilege('authenticated', fn.oid, 'execute');
    service_had := has_function_privilege('service_role', fn.oid, 'execute');

    execute format('revoke all on function %s from public', fn.oid::regprocedure);
    execute format('revoke all on function %s from anon', fn.oid::regprocedure);

    if authenticated_had then
      execute format(
        'grant execute on function %s to authenticated',
        fn.oid::regprocedure
      );
    end if;

    if service_had then
      execute format(
        'grant execute on function %s to service_role',
        fn.oid::regprocedure
      );
    end if;
  end loop;
end;
$$;
