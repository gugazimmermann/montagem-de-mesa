-- storage.objects is shared. One permissive policy per action.

drop policy if exists "Users can upload own food photos" on storage.objects;
drop policy if exists "Users can update own food photos" on storage.objects;
drop policy if exists "Users can read own food photos" on storage.objects;
drop policy if exists "Users can delete own food photos" on storage.objects;
drop policy if exists "Doctors can view linked patient food photos" on storage.objects;
drop policy if exists itens_storage_select_public on storage.objects;
drop policy if exists itens_storage_select_com_acesso on storage.objects;
drop policy if exists itens_storage_insert_own on storage.objects;
drop policy if exists itens_storage_update_own on storage.objects;
drop policy if exists itens_storage_delete_own on storage.objects;
drop policy if exists logos_storage_select_public on storage.objects;
drop policy if exists logos_storage_select_com_acesso on storage.objects;
drop policy if exists logos_storage_insert_own on storage.objects;
drop policy if exists logos_storage_update_own on storage.objects;
drop policy if exists logos_storage_delete_own on storage.objects;

create policy storage_objects_select
  on storage.objects for select
  to anon, authenticated
  using (
    (
      bucket_id = 'food-photos'
      and (
        (select auth.uid())::text = (storage.foldername(name))[1]
        or exists (
          select 1
          from public.doctor_patients dp
          where dp.doctor_id = (select auth.uid())
            and dp.patient_id::text = (storage.foldername(name))[1]
        )
      )
    )
    or (
      bucket_id = 'itens'
      and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
    )
    or (
      bucket_id = 'logos'
      and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
    )
  );

create policy storage_objects_insert
  on storage.objects for insert
  to anon, authenticated
  with check (
    (
      bucket_id = 'food-photos'
      and (select auth.uid())::text = (storage.foldername(name))[1]
    )
    or (
      bucket_id = 'itens'
      and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
      and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
    )
    or (
      bucket_id = 'logos'
      and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
      and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
    )
  );

create policy storage_objects_update
  on storage.objects for update
  to anon, authenticated
  using (
    (
      bucket_id = 'food-photos'
      and (select auth.uid())::text = (storage.foldername(name))[1]
    )
    or (
      bucket_id = 'itens'
      and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
      and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
    )
    or (
      bucket_id = 'logos'
      and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
      and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
    )
  )
  with check (
    (
      bucket_id = 'food-photos'
      and (select auth.uid())::text = (storage.foldername(name))[1]
    )
    or (
      bucket_id = 'itens'
      and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
      and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
    )
    or (
      bucket_id = 'logos'
      and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
      and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
    )
  );

create policy storage_objects_delete
  on storage.objects for delete
  to anon, authenticated
  using (
    (
      bucket_id = 'food-photos'
      and (select auth.uid())::text = (storage.foldername(name))[1]
    )
    or (
      bucket_id = 'itens'
      and public.eh_dono_cliente((storage.foldername(name))[1]::uuid)
      and public.cliente_tem_acesso((storage.foldername(name))[1]::uuid)
    )
    or (
      bucket_id = 'logos'
      and public.eh_dono_cliente(public.storage_cliente_id_do_logo(name)::uuid)
      and public.cliente_tem_acesso(public.storage_cliente_id_do_logo(name)::uuid)
    )
  );
