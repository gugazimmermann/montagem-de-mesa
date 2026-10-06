-- Permite que sessões admin do Dashboard (postgres / supabase_admin)
-- alterem colunas de billing em public.clientes, além do JWT service_role.
-- Sem isso, o Table Editor reverte stripe_customer_id (e afins) no save.

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
  eh_service :=
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    or current_user in ('postgres', 'supabase_admin');

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
