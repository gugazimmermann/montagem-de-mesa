-- Bucket público de logos de clientes (object key: {cliente_id}.webp)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- cliente_id = nome do arquivo sem extensão (ex.: raffiner.webp → raffiner)
create or replace function public.storage_cliente_id_do_logo(object_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(object_name, '\.[^.]+$', '');
$$;

revoke all on function public.storage_cliente_id_do_logo(text) from public;
grant execute on function public.storage_cliente_id_do_logo(text) to authenticated, anon;

drop policy if exists logos_storage_select_public on storage.objects;
create policy logos_storage_select_public
  on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists logos_storage_insert_own on storage.objects;
create policy logos_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name))
  );

drop policy if exists logos_storage_update_own on storage.objects;
create policy logos_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name))
  )
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name))
  );

drop policy if exists logos_storage_delete_own on storage.objects;
create policy logos_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name))
  );
