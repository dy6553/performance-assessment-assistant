create table if not exists public.user_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  device_name text not null check (char_length(device_name) between 1 and 120),
  platform text not null check (char_length(platform) between 1 and 80),
  public_key text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_at timestamptz,
  revoked_at timestamptz,
  primary key (user_id, device_id)
);

create table if not exists public.device_key_envelopes (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  wrapped_key text not null,
  wrapped_by_device_id uuid not null,
  algorithm text not null default 'RSA-OAEP-3072/SHA-256',
  created_at timestamptz not null default now(),
  primary key (user_id, device_id),
  foreign key (user_id, device_id) references public.user_devices(user_id, device_id) on delete cascade
);

create table if not exists public.encrypted_sync_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id text not null,
  record_type text not null,
  version bigint not null check (version > 0),
  source_device_id uuid not null,
  updated_at timestamptz not null,
  deleted_at timestamptz,
  encrypted_payload text not null,
  payload_iv text not null,
  payload_schema_version integer not null default 1,
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, record_id),
  foreign key (user_id, source_device_id) references public.user_devices(user_id, device_id)
);

create table if not exists public.encrypted_sync_files (
  user_id uuid not null references auth.users(id) on delete cascade,
  file_id text not null,
  record_id text not null,
  version bigint not null check (version > 0),
  source_device_id uuid not null,
  storage_path text not null,
  encrypted_file_key text not null,
  key_iv text not null,
  file_iv text not null,
  content_hash text not null,
  byte_size bigint not null check (byte_size >= 0),
  mime_type text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, file_id),
  foreign key (user_id, source_device_id) references public.user_devices(user_id, device_id)
);

create index if not exists encrypted_sync_records_pull_idx on public.encrypted_sync_records(user_id, updated_at, record_id);
create index if not exists encrypted_sync_records_tombstone_idx on public.encrypted_sync_records(deleted_at) where deleted_at is not null;
create index if not exists user_devices_active_idx on public.user_devices(user_id, last_seen_at desc) where revoked_at is null;
create index if not exists encrypted_sync_files_hash_idx on public.encrypted_sync_files(user_id, content_hash);

alter table public.user_devices enable row level security;
alter table public.device_key_envelopes enable row level security;
alter table public.encrypted_sync_records enable row level security;
alter table public.encrypted_sync_files enable row level security;

revoke all on public.user_devices, public.device_key_envelopes, public.encrypted_sync_records, public.encrypted_sync_files from anon, authenticated;

create or replace function public.sync_assert_active_device(p_device_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  if not exists (select 1 from public.user_devices d where d.user_id = v_user and d.device_id = p_device_id and d.revoked_at is null)
  then raise exception 'DEVICE_REVOKED_OR_UNKNOWN' using errcode = '42501'; end if;
  return v_user;
end $$;

create or replace function public.sync_register_device(p_device_id uuid, p_device_name text, p_platform text, p_public_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  insert into public.user_devices(user_id, device_id, device_name, platform, public_key)
  values(v_user, p_device_id, left(p_device_name,120), left(p_platform,80), p_public_key)
  on conflict(user_id,device_id) do update set device_name=excluded.device_name, platform=excluded.platform,
    public_key=excluded.public_key, last_seen_at=now()
    where public.user_devices.revoked_at is null;
  if not exists(select 1 from public.user_devices where user_id=v_user and device_id=p_device_id and revoked_at is null)
  then raise exception 'DEVICE_REVOKED' using errcode='42501'; end if;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.sync_list_devices(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id);
begin
  return jsonb_build_object('devices', coalesce((select jsonb_agg(jsonb_build_object(
    'deviceId',d.device_id,'deviceName',d.device_name,'platform',d.platform,'createdAt',d.created_at,
    'lastSeenAt',d.last_seen_at,'lastSyncAt',d.last_sync_at,'revokedAt',d.revoked_at,'publicKey',d.public_key,
    'hasKeyEnvelope',e.device_id is not null) order by d.created_at)
    from public.user_devices d left join public.device_key_envelopes e on e.user_id=d.user_id and e.device_id=d.device_id
    where d.user_id=v_user), '[]'::jsonb));
end $$;

create or replace function public.sync_get_key_envelope(p_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id); v_wrapped text; v_count int;
begin
  select wrapped_key into v_wrapped from public.device_key_envelopes where user_id=v_user and device_id=p_device_id;
  select count(*) into v_count from public.user_devices where user_id=v_user and revoked_at is null;
  return jsonb_build_object('wrappedKey',v_wrapped,'deviceCount',v_count);
end $$;

create or replace function public.sync_put_key_envelope(p_device_id uuid, p_target_device_id uuid, p_wrapped_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id);
begin
  if not exists(select 1 from public.user_devices where user_id=v_user and device_id=p_target_device_id and revoked_at is null)
  then raise exception 'TARGET_DEVICE_NOT_ACTIVE' using errcode='42501'; end if;
  insert into public.device_key_envelopes(user_id,device_id,wrapped_key,wrapped_by_device_id)
  values(v_user,p_target_device_id,p_wrapped_key,p_device_id)
  on conflict(user_id,device_id) do nothing;
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.sync_push_records(p_device_id uuid, p_records jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id); item jsonb; current_row public.encrypted_sync_records; accepted jsonb := '[]'; conflicts jsonb := '[]';
begin
  if jsonb_array_length(coalesce(p_records,'[]'::jsonb)) > 50 then raise exception 'BATCH_TOO_LARGE'; end if;
  for item in select value from jsonb_array_elements(coalesce(p_records,'[]'::jsonb)) loop
    select * into current_row from public.encrypted_sync_records where user_id=v_user and record_id=item->>'recordId' for update;
    if found and current_row.version <> (item->>'baseVersion')::bigint and current_row.content_hash <> item->>'contentHash' then
      conflicts := conflicts || jsonb_build_array(jsonb_build_object('recordId',current_row.record_id,'recordType',current_row.record_type,'version',current_row.version,'baseVersion',current_row.version-1,'sourceDeviceId',current_row.source_device_id,'updatedAt',current_row.updated_at,'deletedAt',current_row.deleted_at,'encryptedPayload',current_row.encrypted_payload,'payloadIv',current_row.payload_iv,'payloadSchemaVersion',current_row.payload_schema_version,'contentHash',current_row.content_hash));
    else
      insert into public.encrypted_sync_records(user_id,record_id,record_type,version,source_device_id,updated_at,deleted_at,encrypted_payload,payload_iv,payload_schema_version,content_hash)
      values(v_user,item->>'recordId',item->>'recordType',greatest(coalesce(current_row.version,0)+1,(item->>'version')::bigint),p_device_id,coalesce((item->>'updatedAt')::timestamptz,now()),nullif(item->>'deletedAt','')::timestamptz,item->>'encryptedPayload',item->>'payloadIv',(item->>'payloadSchemaVersion')::int,item->>'contentHash')
      on conflict(user_id,record_id) do update set record_type=excluded.record_type,version=excluded.version,source_device_id=excluded.source_device_id,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,encrypted_payload=excluded.encrypted_payload,payload_iv=excluded.payload_iv,payload_schema_version=excluded.payload_schema_version,content_hash=excluded.content_hash;
      accepted := accepted || jsonb_build_array(jsonb_build_object('recordId',item->>'recordId','version',greatest(coalesce(current_row.version,0)+1,(item->>'version')::bigint)));
    end if;
  end loop;
  return jsonb_build_object('accepted',accepted,'conflicts',conflicts);
end $$;

create or replace function public.sync_pull_records(p_device_id uuid, p_cursor timestamptz default '1970-01-01')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id); v_now timestamptz := now();
begin
  return jsonb_build_object('cursor',v_now,'records',coalesce((select jsonb_agg(jsonb_build_object('recordId',r.record_id,'recordType',r.record_type,'version',r.version,'baseVersion',r.version-1,'sourceDeviceId',r.source_device_id,'updatedAt',r.updated_at,'deletedAt',r.deleted_at,'encryptedPayload',r.encrypted_payload,'payloadIv',r.payload_iv,'payloadSchemaVersion',r.payload_schema_version,'contentHash',r.content_hash) order by r.updated_at,r.record_id) from public.encrypted_sync_records r where r.user_id=v_user and r.updated_at>coalesce(p_cursor,'1970-01-01') and r.updated_at<=v_now limit 500),'[]'::jsonb));
end $$;

create or replace function public.sync_touch_device(p_device_id uuid, p_last_sync_at timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id);
begin update public.user_devices set last_seen_at=now(),last_sync_at=coalesce(p_last_sync_at,now()) where user_id=v_user and device_id=p_device_id; return jsonb_build_object('ok',true); end $$;

create or replace function public.sync_revoke_device(p_device_id uuid, p_target_device_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := public.sync_assert_active_device(p_device_id);
begin
  if p_device_id=p_target_device_id then raise exception 'CANNOT_REVOKE_CURRENT_DEVICE'; end if;
  update public.user_devices set revoked_at=coalesce(revoked_at,now()) where user_id=v_user and device_id=p_target_device_id;
  delete from public.device_key_envelopes where user_id=v_user and device_id=p_target_device_id;
  return jsonb_build_object('ok',true);
end $$;

revoke all on function public.sync_assert_active_device(uuid) from public;
revoke all on function public.sync_register_device(uuid,text,text,text), public.sync_list_devices(uuid), public.sync_get_key_envelope(uuid), public.sync_put_key_envelope(uuid,uuid,text), public.sync_push_records(uuid,jsonb), public.sync_pull_records(uuid,timestamptz), public.sync_touch_device(uuid,timestamptz), public.sync_revoke_device(uuid,uuid) from public;
grant execute on function public.sync_register_device(uuid,text,text,text), public.sync_list_devices(uuid), public.sync_get_key_envelope(uuid), public.sync_put_key_envelope(uuid,uuid,text), public.sync_push_records(uuid,jsonb), public.sync_pull_records(uuid,timestamptz), public.sync_touch_device(uuid,timestamptz), public.sync_revoke_device(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit) values('encrypted-sync-files','encrypted-sync-files',false,104857600) on conflict(id) do update set public=false,file_size_limit=104857600;

create policy "encrypted sync storage read active owner" on storage.objects for select to authenticated
using (bucket_id='encrypted-sync-files' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.user_devices d where d.user_id=(select auth.uid()) and d.device_id=((storage.foldername(name))[2])::uuid and d.revoked_at is null));
create policy "encrypted sync storage insert active owner" on storage.objects for insert to authenticated
with check (bucket_id='encrypted-sync-files' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.user_devices d where d.user_id=(select auth.uid()) and d.device_id=((storage.foldername(name))[2])::uuid and d.revoked_at is null));
create policy "encrypted sync storage update active owner" on storage.objects for update to authenticated
using (bucket_id='encrypted-sync-files' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='encrypted-sync-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "encrypted sync storage delete active owner" on storage.objects for delete to authenticated
using (bucket_id='encrypted-sync-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
