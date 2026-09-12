-- Assinatura Stripe: colunas em clientes, cliente_tem_acesso, RLS e view pública.

-- ---------------------------------------------------------------------------
-- Colunas de cobrança
-- ---------------------------------------------------------------------------

alter table public.clientes
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text not null default 'trialing',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz;

alter table public.clientes
  drop constraint if exists clientes_subscription_status_check;

alter table public.clientes
  add constraint clientes_subscription_status_check
  check (
    subscription_status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete'
    )
  );

create unique index if not exists clientes_stripe_customer_id_uidx
  on public.clientes (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists clientes_stripe_subscription_id_uidx
  on public.clientes (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Trial padrão: 14 dias a partir da migration (evita bloquear contas antigas)
update public.clientes
set trial_ends_at = now() + interval '14 days'
where trial_ends_at is null
  and subscription_status = 'trialing';

alter table public.clientes
  alter column trial_ends_at set default (now() + interval '14 days');

-- ---------------------------------------------------------------------------
-- Acesso (trial ativo ou assinatura paga / past_due)
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
        or c.subscription_status in ('active', 'past_due')
      )
  );
$$;

revoke all on function public.cliente_tem_acesso(uuid) from public;
grant execute on function public.cliente_tem_acesso(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Proteção: dono não altera colunas Stripe/status (só service_role)
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
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Coluna id de clientes é imutável';
    end if;

    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Coluna auth_user_id de clientes é imutável';
    end if;

    eh_service := coalesce(auth.jwt() ->> 'role', '') = 'service_role';

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

-- ---------------------------------------------------------------------------
-- View pública: só clientes com acesso
-- ---------------------------------------------------------------------------

create or replace view public.clientes_publicos as
  select id, slug, nome, logo
  from public.clientes
  where public.cliente_tem_acesso(id);

grant select on public.clientes_publicos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS categorias / itens
-- ---------------------------------------------------------------------------

drop policy if exists categorias_select_public on public.categorias;
create policy categorias_select_public
  on public.categorias for select
  using (public.cliente_tem_acesso(cliente_id));

drop policy if exists categorias_insert_own on public.categorias;
create policy categorias_insert_own
  on public.categorias for insert
  with check (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

drop policy if exists categorias_update_own on public.categorias;
create policy categorias_update_own
  on public.categorias for update
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  )
  with check (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

drop policy if exists categorias_delete_own on public.categorias;
create policy categorias_delete_own
  on public.categorias for delete
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

drop policy if exists itens_select_public on public.itens;
create policy itens_select_public
  on public.itens for select
  using (public.cliente_tem_acesso(cliente_id));

drop policy if exists itens_insert_own on public.itens;
create policy itens_insert_own
  on public.itens for insert
  with check (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

drop policy if exists itens_update_own on public.itens;
create policy itens_update_own
  on public.itens for update
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  )
  with check (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

drop policy if exists itens_delete_own on public.itens;
create policy itens_delete_own
  on public.itens for delete
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: writes só com acesso ativo
-- ---------------------------------------------------------------------------

drop policy if exists itens_storage_insert_own on storage.objects;
create policy itens_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
    and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
  );

drop policy if exists itens_storage_update_own on storage.objects;
create policy itens_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
    and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
    and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
  );

drop policy if exists itens_storage_delete_own on storage.objects;
create policy itens_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
    and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
  );

drop policy if exists logos_storage_insert_own on storage.objects;
create policy logos_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
    and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
  );

drop policy if exists logos_storage_update_own on storage.objects;
create policy logos_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
    and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
  )
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
    and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
  );

drop policy if exists logos_storage_delete_own on storage.objects;
create policy logos_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
    and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
  );
