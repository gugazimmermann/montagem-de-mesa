-- Segunda imagem do item: frontal/catálogo (lista de Itens).
-- imagem = mesa; imagem_catalogo = seletor/admin.

alter table public.itens
  add column if not exists imagem_catalogo text;

-- Paths: {cliente}/{categoria}/{item}.ext ou {item}-catalogo.ext
create or replace function public.eh_imagem_item_valida(p_cliente_id uuid, p_imagem text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_imagem is null
    or p_imagem = ''
    or p_imagem ~ (
      '^' || p_cliente_id::text
      || '/[0-9a-f-]{36}/[0-9a-f-]{36}(-catalogo)?\.(jpe?g|png|webp|gif)$'
    )
    or (
      public.eh_url_storage_publica_ou_vazia(p_imagem)
      and (
        position(('/storage/v1/object/public/itens/' || p_cliente_id::text || '/') in p_imagem) > 0
        or position(('/storage/v1/object/sign/itens/' || p_cliente_id::text || '/') in p_imagem) > 0
      )
    );
$$;

alter table public.itens
  drop constraint if exists itens_imagem_catalogo_check;

alter table public.itens
  add constraint itens_imagem_catalogo_check
  check (public.eh_imagem_item_valida(cliente_id, imagem_catalogo));

create or replace function privado.carregar_catalogo_publico(p_slug text)
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

  v_tem_acesso := privado.cliente_tem_acesso(v_cliente.id);

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
            'imagem_catalogo', i.imagem_catalogo,
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
