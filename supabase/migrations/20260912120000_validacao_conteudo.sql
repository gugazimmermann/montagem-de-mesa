-- Validação de conteúdo: cores hex, padrões, dimensões, URLs de Storage.

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

-- URL pública de Storage (https) ou vazio/null.
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

-- Logo: vazio ou Storage do bucket logos com prefixo do cliente.
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

-- Imagem de item: null/vazio ou Storage do bucket itens sob /{clienteId}/.
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

-- Limpa dados inválidos existentes antes dos CHECKs (evita falha na migrate).
update public.itens
set cores = jsonb_build_object(
  'primaria',
  case
    when public.eh_hex_cor(cores->>'primaria') then cores->>'primaria'
    else '#c4a574'
  end,
  'secundaria',
  case
    when public.eh_hex_cor(cores->>'secundaria') then cores->>'secundaria'
    else null
  end,
  'destaque',
  case
    when public.eh_hex_cor(cores->>'destaque') then cores->>'destaque'
    else null
  end
)
where not public.eh_cores_item_validas(cores);

update public.itens
set imagem = null
where imagem is not null
  and imagem <> ''
  and not public.eh_imagem_item_valida(cliente_id, imagem);

update public.itens
set padrao = null
where padrao is not null
  and padrao not in (
    'solid', 'linen', 'stripes', 'gingham', 'damask', 'dots', 'herringbone', 'border'
  );

update public.itens
set largura = null
where largura is not null and largura < 0;

update public.itens
set comprimento = null
where comprimento is not null and comprimento < 0;

update public.clientes
set logo = ''
where logo is not null
  and logo <> ''
  and not public.eh_logo_cliente_valida(id, logo);

alter table public.itens
  drop constraint if exists itens_cores_check;
alter table public.itens
  add constraint itens_cores_check
  check (public.eh_cores_item_validas(cores));

alter table public.itens
  drop constraint if exists itens_imagem_check;
alter table public.itens
  add constraint itens_imagem_check
  check (public.eh_imagem_item_valida(cliente_id, imagem));

alter table public.itens
  drop constraint if exists itens_padrao_check;
alter table public.itens
  add constraint itens_padrao_check
  check (
    padrao is null
    or padrao in (
      'solid', 'linen', 'stripes', 'gingham', 'damask', 'dots', 'herringbone', 'border'
    )
  );

alter table public.itens
  drop constraint if exists itens_dimensoes_check;
alter table public.itens
  add constraint itens_dimensoes_check
  check (
    (largura is null or largura >= 0)
    and (comprimento is null or comprimento >= 0)
  );

alter table public.clientes
  drop constraint if exists clientes_logo_check;
alter table public.clientes
  add constraint clientes_logo_check
  check (public.eh_logo_cliente_valida(id, logo));
