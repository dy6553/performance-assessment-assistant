-- Keep model_registry as the current daily NVIDIA catalog + reviewed policy registry.
-- We do not store one row set per day. Current catalog rows are upserted in place.
-- Unreviewed candidates that disappear from NVIDIA's latest catalog are deleted so
-- stale discovery records do not accumulate. Reviewed/production policy records
-- are retained for auditability but are marked catalog_available=false and cannot
-- be selected by the runtime router.

create or replace function public.sync_nvidia_model_catalog(
  catalog_model_ids text[],
  observed_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sanitized_ids text[];
  live_count integer;
  review_count integer;
  pruned_count integer;
begin
  select coalesce(array_agg(distinct btrim(model_id)), '{}'::text[])
  into sanitized_ids
  from unnest(coalesce(catalog_model_ids, '{}'::text[])) as incoming(model_id)
  where btrim(model_id) <> '';

  if cardinality(sanitized_ids) = 0 then
    raise exception 'NVIDIA model catalog is empty';
  end if;

  -- Start a new current-catalog snapshot in place. This is not a history table.
  update public.model_registry
  set
    catalog_available = false,
    updated_at = now()
  where provider = 'nvidia'
    and catalog_available = true;

  insert into public.model_registry (
    provider,
    model_id,
    enabled,
    developer_company,
    country_of_headquarters,
    china_origin_excluded,
    approved_provider,
    approved_model,
    allowed_for_student_data,
    security_review_passed,
    privacy_policy_verified,
    deprecated,
    capabilities_json,
    limits_json,
    evaluation_profile_json,
    production_approved,
    catalog_available,
    catalog_first_seen_at,
    catalog_last_seen_at,
    catalog_source,
    updated_at
  )
  select
    'nvidia',
    model_id,
    false,
    'UNVERIFIED',
    'UNVERIFIED',
    false,
    true,
    false,
    false,
    false,
    false,
    false,
    jsonb_build_object('catalog_discovered', true),
    '{}'::jsonb,
    jsonb_build_object(
      'status', 'candidate_requires_review',
      'discoveredBy', 'nvidia_models_api'
    ),
    false,
    true,
    observed_at,
    observed_at,
    'nvidia_models_api',
    now()
  from unnest(sanitized_ids) as incoming(model_id)
  on conflict (model_id) do update
  set
    catalog_available = true,
    catalog_last_seen_at = excluded.catalog_last_seen_at,
    catalog_source = 'nvidia_models_api',
    updated_at = now();

  -- Remove only stale, never-approved discovery candidates. Reviewed/approved
  -- policy records are not daily history; keep them for auditability, but because
  -- catalog_available remains false they are excluded from runtime routing.
  delete from public.model_registry
  where provider = 'nvidia'
    and catalog_available = false
    and production_approved = false
    and approved_model = false;

  get diagnostics pruned_count = row_count;

  select count(*)
  into live_count
  from public.model_registry
  where provider = 'nvidia'
    and catalog_available = true;

  select count(*)
  into review_count
  from public.model_registry
  where provider = 'nvidia'
    and catalog_available = true
    and production_approved = false;

  return jsonb_build_object(
    'liveCatalogCount', live_count,
    'reviewCandidateCount', review_count,
    'prunedStaleCandidateCount', pruned_count,
    'observedAt', observed_at
  );
end;
$$;

revoke all on function public.sync_nvidia_model_catalog(text[], timestamptz) from public;
grant execute on function public.sync_nvidia_model_catalog(text[], timestamptz) to service_role;
