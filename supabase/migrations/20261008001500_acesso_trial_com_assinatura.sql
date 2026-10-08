-- Troca mensal → anual deixa a assinatura Stripe em trialing até o aniversário
-- de 12 meses (trial_end). Esse período pago vale até current_period_end.
-- O trial de cadastro, sem assinatura Stripe, continua até trial_ends_at.

create or replace function privado.cliente_tem_acesso(p_cliente_id uuid)
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
          and (
            (
              c.stripe_subscription_id is not null
              and c.current_period_end is not null
              and c.current_period_end > now()
            )
            or (
              c.trial_ends_at is not null
              and c.trial_ends_at > now()
            )
          )
        )
        or (
          c.subscription_status = 'active'
          and c.current_period_end is not null
          and c.current_period_end > now()
        )
        or (
          c.subscription_status = 'past_due'
          and c.current_period_end is not null
          and c.current_period_end + interval '7 days' > now()
        )
      )
  );
$$;
