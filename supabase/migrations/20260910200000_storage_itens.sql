-- Bucket público de imagens de itens (path: {cliente_id}/...)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'itens',
  'itens',
  true,
  5242880,
  array['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (montagem / <img src>)
drop policy if exists itens_storage_select_public on storage.objects;
create policy itens_storage_select_public
  on storage.objects for select
  using (bucket_id = 'itens');

-- Escrita só do dono do cliente (primeiro segmento do path = cliente_id)
drop policy if exists itens_storage_insert_own on storage.objects;
create policy itens_storage_insert_own
  on storage.objects for insert
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1])
  );

drop policy if exists itens_storage_update_own on storage.objects;
create policy itens_storage_update_own
  on storage.objects for update
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1])
  );

drop policy if exists itens_storage_delete_own on storage.objects;
create policy itens_storage_delete_own
  on storage.objects for delete
  using (
    bucket_id = 'itens'
    and public.eh_dono_cliente((storage.foldername(name))[1])
  );
