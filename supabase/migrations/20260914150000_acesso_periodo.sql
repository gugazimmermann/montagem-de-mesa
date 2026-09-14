-- Acesso: respeitar current_period_end em active; RPC status público; RLS montagens.

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

-- Status público do slug (existe / tem_acesso / nome) sem dados sensíveis.
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

drop policy if exists montagens_enviadas_select_own on public.montagens_enviadas;

create policy montagens_enviadas_select_own
  on public.montagens_enviadas
  for select
  to authenticated
  using (
    public.eh_dono_cliente(cliente_id)
    and public.cliente_tem_acesso(cliente_id)
  );
