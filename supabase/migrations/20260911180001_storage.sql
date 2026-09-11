-- Buckets e policies de Storage deste app (itens + logos). Não remove outros buckets.

create or replace function public.storage_cliente_id_do_logo(object_name text)
returns text
language sql
immutable
as $$
  select regexp_replace(object_name, '\.[^.]+$', '');
$$;

revoke all on function public.storage_cliente_id_do_logo(text) from public;
grant execute on function public.storage_cliente_id_do_logo(text) to authenticated, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'itens',
  'itens',
  true,
  5242880,
  array['image/webp', 'image/png', 'image/jpeg', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos',
  'logos',
  true,
  2097152,
  array['image/webp', 'image/png', 'image/jpeg', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies itens
drop policy if exists itens_storage_select_public on storage.objects;
create policy itens_storage_select_public
  on storage.objects for select
  using (bucket_id = 'itens');

drop policy if exists itens_storage_insert_own on storage.objects;
create policy itens_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  );

drop policy if exists itens_storage_update_own on storage.objects;
create policy itens_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  );

drop policy if exists itens_storage_delete_own on storage.objects;
create policy itens_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
  );

-- Policies logos
drop policy if exists logos_storage_select_public on storage.objects;
create policy logos_storage_select_public
  on storage.objects for select
  using (bucket_id = 'logos');

drop policy if exists logos_storage_insert_own on storage.objects;
create policy logos_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  );

drop policy if exists logos_storage_update_own on storage.objects;
create policy logos_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  )
  with check (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  );

drop policy if exists logos_storage_delete_own on storage.objects;
create policy logos_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'logos'
    and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
  );
