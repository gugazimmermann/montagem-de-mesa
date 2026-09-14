-- Segurança: billing imutável também no INSERT; URLs de storage só do host Supabase.

-- ---------------------------------------------------------------------------
-- 1. proteger_clientes_colunas_sensiveis: INSERT + UPDATE
-- ---------------------------------------------------------------------------

create or replace function public.proteger_clientes_colunas_sensiveis()
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
    -- Cadastro via JWT não pode forjar paywall / Stripe.
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

drop trigger if exists trg_proteger_clientes_sensiveis on public.clientes;
create trigger trg_proteger_clientes_sensiveis
  before insert or update on public.clientes
  for each row
  execute function public.proteger_clientes_colunas_sensiveis();

revoke all on function public.proteger_clientes_colunas_sensiveis() from public;

-- ---------------------------------------------------------------------------
-- 2. URLs https de storage: exigir host Supabase (não só substring de path)
-- ---------------------------------------------------------------------------

create or replace function public.eh_url_storage_publica_ou_vazia(valor text)
returns boolean
language sql
immutable
as $$
  select valor is null
    or valor = ''
    or (
      valor !~ '[[:space:]]'
      and valor !~* 'javascript:'
      and (
        -- Path relativo (storage privado + signed URLs no client)
        valor ~ '^[0-9a-f-]{36}(/[0-9a-f-]{36})*/[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$'
        or valor ~ '^[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$'
        or (
          -- URL absoluta só do projeto Supabase (legado public/sign)
          valor ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/(public|sign)/'
        )
        or (
          -- Dev local (supabase start)
          valor ~ '^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/storage/v1/object/(public|sign)/'
        )
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Graça past_due: não usar updated_at (dono pode renovar via UPDATE)
-- ---------------------------------------------------------------------------

create or replace function public.cliente_tem_acesso(p_cliente_id uuid)
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

revoke all on function public.cliente_tem_acesso(uuid) from public;
grant execute on function public.cliente_tem_acesso(uuid) to authenticated, anon;
