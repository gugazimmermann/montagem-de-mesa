-- Otimizações: acesso endurecido, montagens (idempotência/email), rate limit,
-- catálogo público em uma RPC, updated_at, ordem, storage privado.

-- ---------------------------------------------------------------------------
-- 1. cliente_tem_acesso endurecido
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
          and coalesce(c.current_period_end, c.updated_at) + interval '7 days' > now()
        )
      )
  );
$$;

revoke all on function public.cliente_tem_acesso(uuid) from public;
grant execute on function public.cliente_tem_acesso(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2. montagens: email_status + idempotency_key
-- ---------------------------------------------------------------------------

alter table public.montagens_enviadas
  add column if not exists email_status text not null default 'pending'
    constraint montagens_enviadas_email_status_check
      check (email_status in ('pending', 'sent', 'failed')),
  add column if not exists idempotency_key text;

create unique index if not exists montagens_enviadas_cliente_idempotency_uidx
  on public.montagens_enviadas (cliente_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------------
-- 3. rate_limits (service role only)
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  chave text primary key,
  contagem integer not null default 0,
  janela_inicio timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- Sem policies para anon/authenticated: só service_role bypassa RLS.

create or replace function public.verificar_rate_limit(
  p_chave text,
  p_limite integer default 5,
  p_janela_segundos integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.rate_limits%rowtype;
  v_agora timestamptz := now();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'verificar_rate_limit: somente service_role';
  end if;

  select * into v_row from public.rate_limits where chave = p_chave for update;

  if not found then
    insert into public.rate_limits (chave, contagem, janela_inicio)
    values (p_chave, 1, v_agora);
    return true;
  end if;

  if v_row.janela_inicio + make_interval(secs => p_janela_segundos) <= v_agora then
    update public.rate_limits
    set contagem = 1, janela_inicio = v_agora
    where chave = p_chave;
    return true;
  end if;

  if v_row.contagem >= p_limite then
    return false;
  end if;

  update public.rate_limits
  set contagem = contagem + 1
  where chave = p_chave;
  return true;
end;
$$;

revoke all on function public.verificar_rate_limit(text, integer, integer) from public;

-- ---------------------------------------------------------------------------
-- 4. RPC catálogo público (uma ida)
-- ---------------------------------------------------------------------------

create or replace function public.carregar_catalogo_publico(p_slug text)
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

  v_tem_acesso := public.cliente_tem_acesso(v_cliente.id);

  if not v_tem_acesso then
    return jsonb_build_object(
      'existe', true,
      'tem_acesso', false,
      'nome', v_cliente.nome,
      'cliente', null,
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
      'whatsapp', v_cliente.whatsapp
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
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.carregar_catalogo_publico(text) from public;
grant execute on function public.carregar_catalogo_publico(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. updated_at automático
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clientes_set_updated_at on public.clientes;
create trigger clientes_set_updated_at
  before update on public.clientes
  for each row
  execute function public.set_updated_at();

alter table public.categorias
  add column if not exists updated_at timestamptz not null default now();

alter table public.itens
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists categorias_set_updated_at on public.categorias;
create trigger categorias_set_updated_at
  before update on public.categorias
  for each row
  execute function public.set_updated_at();

drop trigger if exists itens_set_updated_at on public.itens;
create trigger itens_set_updated_at
  before update on public.itens
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. próximo ordem (evita count + race)
-- ---------------------------------------------------------------------------

create or replace function public.proximo_ordem_categoria(p_cliente_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(ordem), -1) + 1
  from public.categorias
  where cliente_id = p_cliente_id;
$$;

create or replace function public.proximo_ordem_item(
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
    and categoria_id = p_categoria_id;
$$;

revoke all on function public.proximo_ordem_categoria(uuid) from public;
revoke all on function public.proximo_ordem_item(uuid, uuid) from public;
grant execute on function public.proximo_ordem_categoria(uuid) to authenticated;
grant execute on function public.proximo_ordem_item(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Storage privado (sem SELECT público)
-- ---------------------------------------------------------------------------

update storage.buckets
set public = false
where id in ('itens', 'logos');

drop policy if exists itens_storage_select_public on storage.objects;
drop policy if exists logos_storage_select_public on storage.objects;

-- Leitura quando o tenant tem acesso (anon/auth assinam URLs no load do catálogo).
create policy itens_storage_select_com_acesso
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'itens'
    and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
  );

create policy logos_storage_select_com_acesso
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'logos'
    and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
  );

-- ---------------------------------------------------------------------------
-- 8. Validação de path/URL de storage (path, public legado ou signed)
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
        valor ~ '^[0-9a-f-]{36}(/[0-9a-f-]{36})*/[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$'
        or valor ~ '^[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$'
        or (
          valor ~ '^https://'
          and (
            position('/storage/v1/object/public/' in valor) > 0
            or position('/storage/v1/object/sign/' in valor) > 0
          )
        )
      )
    );
$$;

create or replace function public.eh_logo_cliente_valida(p_cliente_id uuid, p_logo text)
returns boolean
language sql
immutable
as $$
  select p_logo is null
    or p_logo = ''
    or p_logo ~ ('^' || p_cliente_id::text || '\.(jpe?g|png|webp|gif)$')
    or (
      public.eh_url_storage_publica_ou_vazia(p_logo)
      and (
        position(('/storage/v1/object/public/logos/' || p_cliente_id::text || '.') in p_logo) > 0
        or position(('/storage/v1/object/sign/logos/' || p_cliente_id::text || '.') in p_logo) > 0
      )
    );
$$;

create or replace function public.eh_imagem_item_valida(p_cliente_id uuid, p_imagem text)
returns boolean
language sql
immutable
as $$
  select p_imagem is null
    or p_imagem = ''
    or p_imagem ~ (
      '^' || p_cliente_id::text || '/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpe?g|png|webp|gif)$'
    )
    or (
      public.eh_url_storage_publica_ou_vazia(p_imagem)
      and (
        position(('/storage/v1/object/public/itens/' || p_cliente_id::text || '/') in p_imagem) > 0
        or position(('/storage/v1/object/sign/itens/' || p_cliente_id::text || '/') in p_imagem) > 0
      )
    );
$$;

-- Enumeração de e-mail: não expor RPC a authenticated (troca usa Auth).
revoke all on function public.cliente_email_em_uso(text) from public;
revoke all on function public.cliente_email_em_uso(text) from anon, authenticated;
revoke all on function public.cliente_email_em_uso_exceto(text, uuid) from public;
revoke all on function public.cliente_email_em_uso_exceto(text, uuid) from anon, authenticated;
