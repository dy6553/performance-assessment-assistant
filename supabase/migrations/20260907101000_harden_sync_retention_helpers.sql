revoke all on function public.sync_reset_retention_on_version(),public.sync_hold_for_new_device()
from public,anon,authenticated;
grant execute on function public.sync_reset_retention_on_version(),public.sync_hold_for_new_device()
to service_role;
