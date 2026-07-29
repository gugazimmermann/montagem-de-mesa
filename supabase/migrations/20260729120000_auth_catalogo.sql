-- Schema + RLS for montagem-de-mesa (Supabase)

create table public.clientes (
  id text primary key,
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  slug text not null unique,
  email text not null,
  nome text not null,
  logo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categorias (
  cliente_id text not null references public.clientes (id) on delete cascade,
  id text not null,
  rotulo text not null,
  descricao text not null default '',
  ordem integer not null default 0,
  primary key (cliente_id, id)
);

create table public.itens (
  cliente_id text not null references public.clientes (id) on delete cascade,
  id text not null,
  categoria_id text not null,
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

create or replace function public.eh_dono_cliente(p_cliente_id text)
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

revoke all on function public.eh_dono_cliente(text) from public;
grant execute on function public.eh_dono_cliente(text) to authenticated, anon;

alter table public.clientes enable row level security;
alter table public.categorias enable row level security;
alter table public.itens enable row level security;

-- clientes: leitura pública (montagem); update só do dono
create policy clientes_select_public
  on public.clientes for select
  using (true);

create policy clientes_update_own
  on public.clientes for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- categorias: leitura pública; escrita só do dono
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

-- itens: leitura pública; escrita só do dono
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
