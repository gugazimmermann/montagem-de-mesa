-- Evaluate auth.uid() once per statement instead of once per row.
-- Access rules are unchanged.

drop policy if exists clientes_select_own on public.clientes;
create policy clientes_select_own
  on public.clientes for select
  using (auth_user_id = (select auth.uid()));

drop policy if exists clientes_update_own on public.clientes;
create policy clientes_update_own
  on public.clientes for update
  using (auth_user_id = (select auth.uid()))
  with check (auth_user_id = (select auth.uid()));

drop policy if exists clientes_insert_own on public.clientes;
create policy clientes_insert_own
  on public.clientes for insert
  with check (auth_user_id = (select auth.uid()));
