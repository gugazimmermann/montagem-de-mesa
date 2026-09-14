-- Schema único montagem-de-mesa (drop seletivo; não toca em leads nem outras tabelas)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Drop seletivo dos objetos deste app
-- ---------------------------------------------------------------------------

drop policy if exists itens_storage_select_public on storage.objects;
drop policy if exists itens_storage_insert_own on storage.objects;
drop policy if exists itens_storage_update_own on storage.objects;
drop policy if exists itens_storage_delete_own on storage.objects;
drop policy if exists logos_storage_select_public on storage.objects;
drop policy if exists logos_storage_insert_own on storage.objects;
drop policy if exists logos_storage_update_own on storage.objects;
drop policy if exists logos_storage_delete_own on storage.objects;

drop view if exists public.clientes_publicos;

drop table if exists public.montagens_enviadas cascade;
drop table if exists public.itens cascade;
drop table if exists public.categorias cascade;
drop table if exists public.clientes cascade;

drop function if exists public.sincronizar_email_cliente_do_auth();
drop function if exists public.proteger_clientes_colunas_sensiveis();
drop function if exists public.cliente_email_em_uso(text);
drop function if exists public.cliente_email_em_uso_exceto(text, uuid);
drop function if exists public.cliente_slug_em_uso(text);
drop function if exists public.cliente_slug_em_uso_exceto(text, uuid);
drop function if exists public.eh_dono_cliente(uuid);
drop function if exists public.eh_dono_cliente(text);
drop function if exists public.cliente_tem_acesso(uuid);
drop function if exists public.storage_cliente_id_do_logo(text);
drop function if exists public.status_cliente_publico(text);
drop function if exists public.eh_hex_cor(text);
drop function if exists public.eh_cores_item_validas(jsonb);
drop function if exists public.eh_url_storage_publica_ou_vazia(text);
drop function if exists public.eh_logo_cliente_valida(uuid, text);
drop function if exists public.eh_imagem_item_valida(uuid, text);

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  slug text not null unique,
  email text not null,
  nome text not null,
  logo text not null default '',
  whatsapp text not null default '',
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_subscription_status_check check (
    subscription_status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete'
    )
  )
);

create unique index clientes_email_lower_uidx
  on public.clientes (lower(email));

create unique index clientes_stripe_customer_id_uidx
  on public.clientes (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index clientes_stripe_subscription_id_uidx
  on public.clientes (stripe_subscription_id)
  where stripe_subscription_id is not null;

create table public.categorias (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  codigo text,
  rotulo text not null,
  descricao text not null default '',
  ordem integer not null default 0,
  primary key (cliente_id, id)
);

create unique index categorias_cliente_codigo_uidx
  on public.categorias (cliente_id, codigo)
  where codigo is not null;

create table public.itens (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  categoria_id uuid not null,
  nome text not null,
  imagem text,
  cores jsonb not null default '{"primaria":"#c4a574"}'::jsonb,
  largura numeric,
  comprimento numeric,
  padrao text,
  descricao text,
  ordem integer not null default 0,
  primary key (cliente_id, id),
  foreign key (cliente_id, categoria_id)
    references public.categorias (cliente_id, id)
    on delete cascade
);

create index itens_cliente_categoria_idx
  on public.itens (cliente_id, categoria_id);

create table public.montagens_enviadas (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  visitante_nome text not null,
  visitante_email text not null,
  visitante_whatsapp text not null,
  visitante_endereco text not null,
  visitante_cidade text not null,
  visitante_estado text not null,
  itens jsonb not null default '[]'::jsonb,
  link_montagem text not null,
  created_at timestamptz not null default now()
);

create index montagens_enviadas_cliente_created_idx
  on public.montagens_enviadas (cliente_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Validação de conteúdo
-- ---------------------------------------------------------------------------

create or replace function public.eh_hex_cor(valor text)
returns boolean
language sql
immutable
as $$
  select valor is not null
    and valor ~ '^#[0-9A-Fa-f]{6}$';
$$;

revoke all on function public.eh_hex_cor(text) from public;
grant execute on function public.eh_hex_cor(text) to authenticated, anon;

create or replace function public.eh_cores_item_validas(cores jsonb)
returns boolean
language sql
immutable
as $$
  select cores is not null
    and jsonb_typeof(cores) = 'object'
    and public.eh_hex_cor(cores->>'primaria')
    and (
      cores->>'secundaria' is null
      or public.eh_hex_cor(cores->>'secundaria')
    )
    and (
      cores->>'destaque' is null
      or public.eh_hex_cor(cores->>'destaque')
    );
$$;

revoke all on function public.eh_cores_item_validas(jsonb) from public;
grant execute on function public.eh_cores_item_validas(jsonb) to authenticated, anon;

create or replace function public.eh_url_storage_publica_ou_vazia(valor text)
returns boolean
language sql
immutable
as $$
  select valor is null
    or valor = ''
    or (
      valor ~ '^https://'
      and position('/storage/v1/object/public/' in valor) > 0
      and valor !~ '[[:space:]]'
      and valor !~* 'javascript:'
    );
$$;

revoke all on function public.eh_url_storage_publica_ou_vazia(text) from public;
grant execute on function public.eh_url_storage_publica_ou_vazia(text) to authenticated, anon;

create or replace function public.eh_logo_cliente_valida(p_cliente_id uuid, p_logo text)
returns boolean
language sql
immutable
as $$
  select p_logo is null
    or p_logo = ''
    or (
      public.eh_url_storage_publica_ou_vazia(p_logo)
      and position('/storage/v1/object/public/logos/' in p_logo) > 0
      and position(('/' || p_cliente_id::text || '.') in p_logo) > 0
    );
$$;

revoke all on function public.eh_logo_cliente_valida(uuid, text) from public;
grant execute on function public.eh_logo_cliente_valida(uuid, text) to authenticated, anon;

create or replace function public.eh_imagem_item_valida(p_cliente_id uuid, p_imagem text)
returns boolean
language sql
immutable
as $$
  select p_imagem is null
    or p_imagem = ''
    or (
      public.eh_url_storage_publica_ou_vazia(p_imagem)
      and position(('/storage/v1/object/public/itens/' || p_cliente_id::text || '/') in p_imagem) > 0
    );
$$;

revoke all on function public.eh_imagem_item_valida(uuid, text) from public;
grant execute on function public.eh_imagem_item_valida(uuid, text) to authenticated, anon;

alter table public.itens
  add constraint itens_cores_check
  check (public.eh_cores_item_validas(cores));

alter table public.itens
  add constraint itens_imagem_check
  check (public.eh_imagem_item_valida(cliente_id, imagem));

alter table public.itens
  add constraint itens_padrao_check
  check (
    padrao is null
    or padrao in (
      'solid', 'linen', 'stripes', 'gingham', 'damask', 'dots', 'herringbone', 'border'
    )
  );

alter table public.itens
  add constraint itens_dimensoes_check
  check (
    (largura is null or largura >= 0)
    and (comprimento is null or comprimento >= 0)
  );

alter table public.clientes
  add constraint clientes_logo_check
  check (public.eh_logo_cliente_valida(id, logo));

-- ---------------------------------------------------------------------------
-- Helpers / RPCs
-- ---------------------------------------------------------------------------

create or replace function public.eh_dono_cliente(p_cliente_id uuid)
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

revoke all on function public.eh_dono_cliente(uuid) from public;
grant execute on function public.eh_dono_cliente(uuid) to authenticated, anon;

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
          and (
            c.current_period_end is null
            or c.current_period_end > now()
          )
        )
        or c.subscription_status = 'past_due'
      )
  );
$$;

revoke all on function public.cliente_tem_acesso(uuid) from public;
grant execute on function public.cliente_tem_acesso(uuid) to authenticated, anon;

create or replace function public.status_cliente_publico(p_slug text)
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
    public.cliente_tem_acesso(c.id) as tem_acesso,
    c.nome
  from public.clientes c
  where c.slug = trim(p_slug)
  limit 1;
$$;

revoke all on function public.status_cliente_publico(text) from public;
grant execute on function public.status_cliente_publico(text) to anon, authenticated;

create or replace function public.cliente_email_em_uso(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clientes
    where lower(email) = lower(trim(p_email))
  );
$$;

create or replace function public.cliente_email_em_uso_exceto(
  p_email text,
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
    where lower(email) = lower(trim(p_email))
      and id <> p_cliente_id
  );
$$;

create or replace function public.cliente_slug_em_uso(p_slug text)
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

create or replace function public.cliente_slug_em_uso_exceto(
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

revoke all on function public.cliente_email_em_uso(text) from public;
revoke all on function public.cliente_email_em_uso_exceto(text, uuid) from public;
revoke all on function public.cliente_slug_em_uso(text) from public;
revoke all on function public.cliente_slug_em_uso_exceto(text, uuid) from public;

grant execute on function public.cliente_email_em_uso(text) to authenticated;
grant execute on function public.cliente_email_em_uso_exceto(text, uuid) to authenticated;
grant execute on function public.cliente_slug_em_uso(text) to anon, authenticated;
grant execute on function public.cliente_slug_em_uso_exceto(text, uuid) to anon, authenticated;

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

create trigger trg_proteger_clientes_sensiveis
  before update on public.clientes
  for each row
  execute function public.proteger_clientes_colunas_sensiveis();

revoke all on function public.proteger_clientes_colunas_sensiveis() from public;

create or replace function public.sincronizar_email_cliente_do_auth()
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

revoke all on function public.sincronizar_email_cliente_do_auth() from public;
grant execute on function public.sincronizar_email_cliente_do_auth() to authenticated;

create or replace function public.storage_cliente_id_do_logo(object_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(object_name, '\.[^.]+$', '');
$$;

revoke all on function public.storage_cliente_id_do_logo(text) from public;
grant execute on function public.storage_cliente_id_do_logo(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- View pública + RLS
-- ---------------------------------------------------------------------------

create or replace view public.clientes_publicos as
  select id, slug, nome, logo, whatsapp
  from public.clientes
  where public.cliente_tem_acesso(id);

grant select on public.clientes_publicos to anon, authenticated;

alter table public.clientes enable row level security;
alter table public.categorias enable row level security;
alter table public.itens enable row level security;
alter table public.montagens_enviadas enable row level security;

create policy clientes_select_own
  on public.clientes for select
  using (auth_user_id = auth.uid());

create policy clientes_update_own
  on public.clientes for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy clientes_insert_own
  on public.clientes for insert
  with check (auth_user_id = auth.uid());

create policy categorias_select_public
  on public.categorias for select
  using (public.cliente_tem_acesso(cliente_id));

create policy categorias_insert_own
  on public.categorias for insert
  with check (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

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

create policy categorias_delete_own
  on public.categorias for delete
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

create policy itens_select_public
  on public.itens for select
  using (public.cliente_tem_acesso(cliente_id));

create policy itens_insert_own
  on public.itens for insert
  with check (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

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

create policy itens_delete_own
  on public.itens for delete
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

create policy montagens_enviadas_select_own
  on public.montagens_enviadas
  for select
  to authenticated
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

grant select on public.montagens_enviadas to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: buckets + policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'itens',
  'itens',
  true,
  5242880,
  array['image/webp', 'image/png', 'image/jpeg', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/webp', 'image/png', 'image/jpeg', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy itens_storage_select_public
  on storage.objects for select
  using (bucket_id = 'itens');

create policy itens_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
    and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
  );

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

create policy itens_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
    and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
  );

create policy logos_storage_select_public
  on storage.objects for select
  using (bucket_id = 'logos');

create policy logos_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
    and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
  );

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

create policy logos_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
    and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
  );
