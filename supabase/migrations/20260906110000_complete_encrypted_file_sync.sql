create or replace function public.sync_get_file_state(p_device_id uuid, p_file_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id); v_row public.encrypted_sync_files;
begin
  select * into v_row from public.encrypted_sync_files where user_id=v_user and file_id=p_file_id;
  return jsonb_build_object('exists',found,'version',coalesce(v_row.version,0),'contentHash',v_row.content_hash,'storagePath',v_row.storage_path,'fileIv',v_row.file_iv);
end $$;

create or replace function public.sync_prepare_file_upload(p_device_id uuid, p_file_id text, p_version bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id); v_path text;
begin
  v_path := v_user::text || '/' || p_device_id::text || '/' || encode(sha256(convert_to(p_file_id,'UTF8')),'hex') || '-' || greatest(p_version,1)::text || '.bin';
  return jsonb_build_object('storagePath',v_path);
end $$;

create or replace function public.sync_commit_file(p_device_id uuid, p_file_id text, p_record_id text, p_version bigint, p_storage_path text, p_file_iv text, p_content_hash text, p_byte_size bigint, p_mime_type text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id); v_prefix text := v_user::text || '/' || p_device_id::text || '/';
begin
  if p_storage_path not like v_prefix || '%' then raise exception 'INVALID_STORAGE_PATH' using errcode='42501'; end if;
  insert into public.encrypted_sync_files(user_id,file_id,record_id,version,source_device_id,storage_path,encrypted_file_key,key_iv,file_iv,content_hash,byte_size,mime_type,updated_at,deleted_at)
  values(v_user,p_file_id,p_record_id,greatest(p_version,1),p_device_id,p_storage_path,'account-sync-key-v1','',p_file_iv,p_content_hash,p_byte_size,left(p_mime_type,200),now(),null)
  on conflict(user_id,file_id) do update set record_id=excluded.record_id,version=greatest(public.encrypted_sync_files.version+1,excluded.version),source_device_id=excluded.source_device_id,storage_path=excluded.storage_path,file_iv=excluded.file_iv,content_hash=excluded.content_hash,byte_size=excluded.byte_size,mime_type=excluded.mime_type,updated_at=now(),deleted_at=null;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.sync_list_files(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id);
begin
  return jsonb_build_object('files',coalesce((select jsonb_agg(jsonb_build_object('fileId',f.file_id,'recordId',f.record_id,'version',f.version,'storagePath',f.storage_path,'fileIv',f.file_iv,'contentHash',f.content_hash,'byteSize',f.byte_size,'mimeType',f.mime_type,'updatedAt',f.updated_at,'deletedAt',f.deleted_at)) from public.encrypted_sync_files f where f.user_id=v_user),'[]'::jsonb));
end $$;

revoke all on function public.sync_get_file_state(uuid,text), public.sync_prepare_file_upload(uuid,text,bigint), public.sync_commit_file(uuid,text,text,bigint,text,text,text,bigint,text), public.sync_list_files(uuid) from public;
grant execute on function public.sync_get_file_state(uuid,text), public.sync_prepare_file_upload(uuid,text,bigint), public.sync_commit_file(uuid,text,text,bigint,text,text,text,bigint,text), public.sync_list_files(uuid) to authenticated;
