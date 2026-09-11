-- Migração destrutiva: IDs de clientes/categorias/itens passam a UUID.
-- Reexecute o seed depois: npm run seed:supabase
-- (e reenvie logos/imagens se necessário)

create extension if not exists "pgcrypto";

-- Remove policies de storage que dependem de eh_dono_cliente(text)
drop policy if exists itens_storage_insert_own on storage.objects;
drop policy if exists itens_storage_update_own on storage.objects;
drop policy if exists itens_storage_delete_own on storage.objects;
drop policy if exists logos_storage_insert_own on storage.objects;
drop policy if exists logos_storage_update_own on storage.objects;
drop policy if exists logos_storage_delete_own on storage.objects;

drop table if exists public.itens cascade;
drop table if exists public.categorias cascade;
drop table if exists public.clientes cascade;

drop function if exists public.eh_dono_cliente(text);
drop function if exists public.eh_dono_cliente(uuid);

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

create table public.categorias (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  rotulo text not null,
  descricao text not null default '',
  ordem integer not null default 0,
  primary key (cliente_id, id)
);

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

alter table public.clientes enable row level security;
alter table public.categorias enable row level security;
alter table public.itens enable row level security;

drop policy if exists clientes_select_public on public.clientes;
create policy clientes_select_public
  on public.clientes for select
  using (true);

drop policy if exists clientes_update_own on public.clientes;
create policy clientes_update_own
  on public.clientes for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists clientes_insert_own on public.clientes;
create policy clientes_insert_own
  on public.clientes for insert
  with check (auth_user_id = auth.uid());

drop policy if exists categorias_select_public on public.categorias;
create policy categorias_select_public
  on public.categorias for select
  using (true);

drop policy if exists categorias_insert_own on public.categorias;
create policy categorias_insert_own
  on public.categorias for insert
  with check (public.eh_dono_cliente(cliente_id));

drop policy if exists categorias_update_own on public.categorias;
create policy categorias_update_own
  on public.categorias for update
  using (public.eh_dono_cliente(cliente_id))
  with check (public.eh_dono_cliente(cliente_id));

drop policy if exists categorias_delete_own on public.categorias;
create policy categorias_delete_own
  on public.categorias for delete
  using (public.eh_dono_cliente(cliente_id));

drop policy if exists itens_select_public on public.itens;
create policy itens_select_public
  on public.itens for select
  using (true);

drop policy if exists itens_insert_own on public.itens;
create policy itens_insert_own
  on public.itens for insert
  with check (public.eh_dono_cliente(cliente_id));

drop policy if exists itens_update_own on public.itens;
create policy itens_update_own
  on public.itens for update
  using (public.eh_dono_cliente(cliente_id))
  with check (public.eh_dono_cliente(cliente_id));

drop policy if exists itens_delete_own on public.itens;
create policy itens_delete_own
  on public.itens for delete
  using (public.eh_dono_cliente(cliente_id));

-- Recria policies de storage com cast text → uuid
create policy itens_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  );

create policy itens_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  );

create policy itens_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  );

-- Garante a helper de logos (criada em 20260910210000; pode faltar se só este SQL foi aplicado)
create or replace function public.storage_cliente_id_do_logo(object_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(object_name, '\.[^.]+$', '');
$$;

revoke all on function public.storage_cliente_id_do_logo(text) from public;
grant execute on function public.storage_cliente_id_do_logo(text) to authenticated, anon;

create policy logos_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  );

create policy logos_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  )
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  );

create policy logos_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  );
