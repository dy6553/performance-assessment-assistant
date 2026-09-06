do $$
declare t text;
begin
  foreach t in array array['user_devices','device_key_envelopes','encrypted_sync_records','encrypted_sync_files'] loop
    execute format('drop policy if exists "sync owner isolation" on public.%I',t);
    execute format('create policy "sync owner isolation" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',t);
  end loop;
end $$;

revoke all on function public.sync_assert_active_device(uuid), public.sync_register_device(uuid,text,text,text), public.sync_list_devices(uuid), public.sync_get_key_envelope(uuid), public.sync_put_key_envelope(uuid,uuid,text), public.sync_push_records(uuid,jsonb), public.sync_pull_records(uuid,timestamptz), public.sync_touch_device(uuid,timestamptz), public.sync_revoke_device(uuid,uuid), public.sync_get_file_state(uuid,text), public.sync_prepare_file_upload(uuid,text,bigint), public.sync_commit_file(uuid,text,text,bigint,text,text,text,bigint,text), public.sync_list_files(uuid) from anon;
grant execute on function public.sync_assert_active_device(uuid), public.sync_register_device(uuid,text,text,text), public.sync_list_devices(uuid), public.sync_get_key_envelope(uuid), public.sync_put_key_envelope(uuid,uuid,text), public.sync_push_records(uuid,jsonb), public.sync_pull_records(uuid,timestamptz), public.sync_touch_device(uuid,timestamptz), public.sync_revoke_device(uuid,uuid), public.sync_get_file_state(uuid,text), public.sync_prepare_file_upload(uuid,text,bigint), public.sync_commit_file(uuid,text,text,bigint,text,text,text,bigint,text), public.sync_list_files(uuid) to authenticated;
