-- Mini-CRM em montagens_enviadas + soft-delete de catálogo.

-- ---------------------------------------------------------------------------
-- 1. Lead workflow
-- ---------------------------------------------------------------------------

alter table public.montagens_enviadas
  add column if not exists lead_status text not null default 'novo'
    constraint montagens_enviadas_lead_status_check
      check (lead_status in ('novo', 'contatado', 'fechado', 'arquivado')),
  add column if not exists nota_interna text not null default '';

create index if not exists montagens_enviadas_cliente_lead_idx
  on public.montagens_enviadas (cliente_id, lead_status, created_at desc);

drop policy if exists montagens_enviadas_update_own on public.montagens_enviadas;

create policy montagens_enviadas_update_own
  on public.montagens_enviadas
  for update
  to authenticated
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  )
  with check (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );

grant select, update on public.montagens_enviadas to authenticated;

-- Só lead_status / nota_interna via trigger (protege demais colunas)
create or replace function public.proteger_montagens_update()
returns trigger
language plpgsql
as $$
begin
  -- Service role (Edge Functions) pode atualizar email_status / demais campos.
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.cliente_id is distinct from old.cliente_id
    or new.visitante_nome is distinct from old.visitante_nome
    or new.visitante_email is distinct from old.visitante_email
    or new.visitante_whatsapp is distinct from old.visitante_whatsapp
    or new.visitante_endereco is distinct from old.visitante_endereco
    or new.visitante_cidade is distinct from old.visitante_cidade
    or new.visitante_estado is distinct from old.visitante_estado
    or new.itens is distinct from old.itens
    or new.link_montagem is distinct from old.link_montagem
    or new.created_at is distinct from old.created_at
    or new.email_status is distinct from old.email_status
    or new.idempotency_key is distinct from old.idempotency_key
  then
    raise exception 'Atualização permitida apenas em lead_status e nota_interna';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_montagens_update on public.montagens_enviadas;
create trigger trg_proteger_montagens_update
  before update on public.montagens_enviadas
  for each row
  execute function public.proteger_montagens_update();

-- ---------------------------------------------------------------------------
-- 2. Soft-delete catálogo
-- ---------------------------------------------------------------------------

alter table public.categorias
  add column if not exists deleted_at timestamptz;

alter table public.itens
  add column if not exists deleted_at timestamptz;

create index if not exists categorias_cliente_ativas_idx
  on public.categorias (cliente_id, ordem)
  where deleted_at is null;

create index if not exists itens_cliente_ativos_idx
  on public.itens (cliente_id, categoria_id, ordem)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- 3. RPC pública ignora soft-deleted
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

-- ---------------------------------------------------------------------------
-- 4. Troca de ordem (setas no painel)
-- ---------------------------------------------------------------------------

create or replace function public.trocar_ordem_categoria(
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
  if not public.eh_dono_cliente(p_cliente_id) then
    raise exception 'Sem permissão';
  end if;
  if not public.cliente_tem_acesso(p_cliente_id) then
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

create or replace function public.trocar_ordem_item(
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
  if not public.eh_dono_cliente(p_cliente_id) then
    raise exception 'Sem permissão';
  end if;
  if not public.cliente_tem_acesso(p_cliente_id) then
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

revoke all on function public.trocar_ordem_categoria(uuid, uuid, uuid) from public;
revoke all on function public.trocar_ordem_item(uuid, uuid, uuid, uuid) from public;
grant execute on function public.trocar_ordem_categoria(uuid, uuid, uuid) to authenticated;
grant execute on function public.trocar_ordem_item(uuid, uuid, uuid, uuid) to authenticated;

-- Soft-delete: próximo ordem ignora excluídos
create or replace function public.proximo_ordem_categoria(p_cliente_id uuid)
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
    and categoria_id = p_categoria_id
    and deleted_at is null;
$$;
