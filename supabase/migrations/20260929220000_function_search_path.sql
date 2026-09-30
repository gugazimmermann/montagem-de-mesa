-- Pin search_path on every non-extension function in public that still
-- leaves it unset (Supabase lint function_search_path_mutable).
-- Already-applied migrations are not re-run, so this is what the hosted
-- database picks up.

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
        where cfg like 'search_path=%'
      )
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
  loop
    execute format('alter function %s set search_path = public', fn.signature);
  end loop;
end;
$$;
