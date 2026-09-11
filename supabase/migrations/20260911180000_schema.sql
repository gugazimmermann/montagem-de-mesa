-- Schema final montagem-de-mesa (drop seletivo; não toca em leads nem outras tabelas)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Drop seletivo dos objetos deste app
-- ---------------------------------------------------------------------------

-- Policies de Storage deste app (dependem de eh_dono_cliente / helper de logo)
drop policy if exists itens_storage_select_public on storage.objects;
drop policy if exists itens_storage_insert_own on storage.objects;
drop policy if exists itens_storage_update_own on storage.objects;
drop policy if exists itens_storage_delete_own on storage.objects;
drop policy if exists logos_storage_select_public on storage.objects;
drop policy if exists logos_storage_insert_own on storage.objects;
drop policy if exists logos_storage_update_own on storage.objects;
drop policy if exists logos_storage_delete_own on storage.objects;

drop view if exists public.clientes_publicos;

-- CASCADE remove triggers e policies das tabelas
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
drop function if exists public.storage_cliente_id_do_logo(text);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index clientes_email_lower_uidx
  on public.clientes (lower(email));

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

-- E-mail: só autenticado (evita oráculo para anon). Slug: anon + authenticated.
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
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Coluna id de clientes é imutável';
    end if;

    if new.auth_user_id is distinct from old.auth_user_id then
      raise exception 'Coluna auth_user_id de clientes é imutável';
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

-- ---------------------------------------------------------------------------
-- View pública (sem e-mail) + RLS
-- ---------------------------------------------------------------------------

create or replace view public.clientes_publicos as
  select id, slug, nome, logo
  from public.clientes;

grant select on public.clientes_publicos to anon, authenticated;

alter table public.clientes enable row level security;
alter table public.categorias enable row level security;
alter table public.itens enable row level security;

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
  using (true);

create policy categorias_insert_own
  on public.categorias for insert
  with check (public.eh_dono_cliente(cliente_id));

create policy categorias_update_own
  on public.categorias for update
  using (public.eh_dono_cliente(cliente_id))
  with check (public.eh_dono_cliente(cliente_id));

create policy categorias_delete_own
  on public.categorias for delete
  using (public.eh_dono_cliente(cliente_id));

create policy itens_select_public
  on public.itens for select
  using (true);

create policy itens_insert_own
  on public.itens for insert
  with check (public.eh_dono_cliente(cliente_id));

create policy itens_update_own
  on public.itens for update
  using (public.eh_dono_cliente(cliente_id))
  with check (public.eh_dono_cliente(cliente_id));

create policy itens_delete_own
  on public.itens for delete
  using (public.eh_dono_cliente(cliente_id));
