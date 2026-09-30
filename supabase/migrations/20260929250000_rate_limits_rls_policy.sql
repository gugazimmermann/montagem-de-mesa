-- rate_limits is written only by verificar_rate_limit (service role).
-- An explicit deny policy keeps the Data API closed and clears the
-- "RLS enabled, no policy" linter warning. service_role bypasses RLS.

drop policy if exists "No direct API access" on public.rate_limits;
create policy "No direct API access"
  on public.rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);
