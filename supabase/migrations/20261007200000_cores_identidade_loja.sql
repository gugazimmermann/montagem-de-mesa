-- Cores de identidade da loja (destaque + fundo) na página pública.

alter table public.clientes
  add column if not exists cor_marca text not null default '',
  add column if not exists cor_fundo text not null default '';

alter table public.clientes
  drop constraint if exists clientes_cor_marca_check,
  drop constraint if exists clientes_cor_fundo_check;

alter table public.clientes
  add constraint clientes_cor_marca_check
    check (cor_marca = '' or public.eh_hex_cor(cor_marca)),
  add constraint clientes_cor_fundo_check
    check (cor_fundo = '' or public.eh_hex_cor(cor_fundo));

drop view if exists public.clientes_publicos;
drop function if exists privado.clientes_publicos_visiveis();

create function privado.clientes_publicos_visiveis()
returns table (
  id uuid,
  slug text,
  nome text,
  logo text,
  whatsapp text,
  cor_marca text,
  cor_fundo text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.slug, c.nome, c.logo, c.whatsapp, c.cor_marca, c.cor_fundo
  from public.clientes c
  where public.cliente_tem_acesso(c.id);
$$;

revoke all on function privado.clientes_publicos_visiveis() from public;
grant execute on function privado.clientes_publicos_visiveis() to anon, authenticated;

create view public.clientes_publicos
with (security_invoker = true) as
  select id, slug, nome, logo, whatsapp, cor_marca, cor_fundo
  from privado.clientes_publicos_visiveis();

alter view public.clientes_publicos set (security_invoker = true);

grant select on public.clientes_publicos to anon, authenticated;

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
        'cor_marca', v_cliente.cor_marca,
        'cor_fundo', v_cliente.cor_fundo
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
      'cor_marca', v_cliente.cor_marca,
      'cor_fundo', v_cliente.cor_fundo
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
