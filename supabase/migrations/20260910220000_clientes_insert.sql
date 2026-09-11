-- Allow newly authenticated users to create their own clientes row.
create policy clientes_insert_own
  on public.clientes for insert
  with check (auth_user_id = auth.uid());
