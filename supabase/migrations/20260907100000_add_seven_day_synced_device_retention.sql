-- Encrypted relay retention: keep ciphertext until every active device acknowledges the same version,
-- then retain it for seven more days. Storage objects are deleted by the encrypted-sync-retention Edge Function.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.encrypted_sync_records add column if not exists server_expires_at timestamptz;
alter table public.encrypted_sync_files add column if not exists server_expires_at timestamptz;

create table if not exists public.sync_delivery_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_kind text not null check (item_kind in ('record','file')),
  item_id text not null,
  version bigint not null check (version > 0),
  device_id uuid not null,
  received_at timestamptz not null default now(),
  primary key (user_id,item_kind,item_id,version,device_id),
  foreign key (user_id,device_id) references public.user_devices(user_id,device_id) on delete cascade
);
create index if not exists sync_delivery_receipts_item_idx on public.sync_delivery_receipts(user_id,item_kind,item_id,version);
create index if not exists encrypted_sync_records_expiry_idx on public.encrypted_sync_records(server_expires_at) where server_expires_at is not null;
create index if not exists encrypted_sync_files_expiry_idx on public.encrypted_sync_files(server_expires_at) where server_expires_at is not null;
alter table public.sync_delivery_receipts enable row level security;
revoke all on public.sync_delivery_receipts from anon,authenticated;
create policy "sync receipt owner isolation" on public.sync_delivery_receipts for all to authenticated
using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create or replace function public.sync_ack_items(p_device_id uuid,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.sync_assert_active_device(p_device_id); x jsonb; k text; i text; v bigint; n int:=0;
begin
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb))>500 then raise exception 'BATCH_TOO_LARGE'; end if;
  for x in select value from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    k:=x->>'itemKind'; i:=x->>'itemId'; v:=(x->>'version')::bigint;
    if (k='record' and exists(select 1 from public.encrypted_sync_records where user_id=u and record_id=i and version=v))
       or (k='file' and exists(select 1 from public.encrypted_sync_files where user_id=u and file_id=i and version=v)) then
      insert into public.sync_delivery_receipts values(u,k,i,v,p_device_id,now())
      on conflict(user_id,item_kind,item_id,version,device_id) do update set received_at=excluded.received_at;
      if k='record' then
        update public.encrypted_sync_records r set server_expires_at=case when not exists(
          select 1 from public.user_devices d where d.user_id=u and d.revoked_at is null and not exists(
            select 1 from public.sync_delivery_receipts a where a.user_id=u and a.item_kind=k and a.item_id=i and a.version=v and a.device_id=d.device_id))
          then coalesce(r.server_expires_at,now()+interval '7 days') else null end
        where r.user_id=u and r.record_id=i and r.version=v;
      else
        update public.encrypted_sync_files f set server_expires_at=case when not exists(
          select 1 from public.user_devices d where d.user_id=u and d.revoked_at is null and not exists(
            select 1 from public.sync_delivery_receipts a where a.user_id=u and a.item_kind=k and a.item_id=i and a.version=v and a.device_id=d.device_id))
          then coalesce(f.server_expires_at,now()+interval '7 days') else null end
        where f.user_id=u and f.file_id=i and f.version=v;
      end if;
      n:=n+1;
    end if;
  end loop;
  return jsonb_build_object('accepted',n);
end $$;

create or replace function public.sync_retention_storage_candidates()
returns jsonb language sql security definer set search_path='' as $$
select coalesce(jsonb_agg(jsonb_build_object('userId',user_id,'fileId',file_id,'storagePath',storage_path)),'[]'::jsonb)
from (select user_id,file_id,storage_path from public.encrypted_sync_files f where f.server_expires_at<=now()
and not exists(select 1 from public.user_devices d where d.user_id=f.user_id and d.revoked_at is null and not exists(
select 1 from public.sync_delivery_receipts a where a.user_id=f.user_id and a.item_kind='file' and a.item_id=f.file_id and a.version=f.version and a.device_id=d.device_id))
order by server_expires_at limit 500) q $$;

create or replace function public.sync_finalize_retention(p_storage_paths text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare fd int:=0; rd int:=0;
begin
 delete from public.encrypted_sync_files f where f.storage_path=any(coalesce(p_storage_paths,array[]::text[])) and f.server_expires_at<=now();
 get diagnostics fd=row_count;
 delete from public.encrypted_sync_records r where r.server_expires_at<=now() and not exists(
  select 1 from public.user_devices d where d.user_id=r.user_id and d.revoked_at is null and not exists(
   select 1 from public.sync_delivery_receipts a where a.user_id=r.user_id and a.item_kind='record' and a.item_id=r.record_id and a.version=r.version and a.device_id=d.device_id));
 get diagnostics rd=row_count;
 return jsonb_build_object('filesDeleted',fd,'recordsDeleted',rd);
end $$;
revoke all on function public.sync_ack_items(uuid,jsonb),public.sync_retention_storage_candidates(),public.sync_finalize_retention(text[]) from public,anon;
grant execute on function public.sync_ack_items(uuid,jsonb) to authenticated;
grant execute on function public.sync_retention_storage_candidates(),public.sync_finalize_retention(text[]) to service_role;
