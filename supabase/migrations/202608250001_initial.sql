-- wanhee 수행평가 도우미 초기 데이터 모델
-- 모든 public 테이블은 RLS를 활성화하고, 학생 소유 데이터는 auth.uid()로 격리한다.
-- 2026-08 신규 Supabase 프로젝트의 Data API 기본 비노출 정책을 고려해 필요한 GRANT를 명시한다.
-- Storage bucket 자체는 Storage API/Dashboard에서 생성하고, 여기서는 storage.objects RLS 정책만 정의한다.

create extension if not exists pgcrypto;

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  school_year integer not null,
  school_level text not null,
  grade integer not null,
  subject text not null,
  course text,
  assignment_type text,
  topic text not null,
  teacher_instruction text not null,
  length_rule text,
  format_rule text,
  status text not null default 'INPUT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.curriculum_context (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  curriculum_version text not null,
  standard_code text,
  standard_text text,
  relevance_score numeric(5,4),
  verification_status text not null default 'unverified',
  source_url text,
  retrieved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.rubric_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  name text not null,
  description text not null,
  max_score numeric,
  performance_levels_json jsonb not null default '[]'::jsonb,
  source_type text not null,
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  title text not null,
  canonical_url text not null,
  publisher text,
  published_at timestamptz,
  updated_at timestamptz,
  retrieved_at timestamptz not null default now(),
  source_grade text,
  source_type text,
  claim_supported text,
  content_hash text
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  version integer not null default 1,
  content_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, version)
);

create table public.verification_results (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  verification_type text not null,
  severity text,
  location text,
  issue text,
  evidence text,
  suggested_fix text,
  status text not null,
  created_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  draft_id uuid references public.drafts(id) on delete cascade,
  claim_text text not null,
  claim_type text,
  location text,
  importance text,
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now()
);

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  source_excerpt text,
  source_locator text,
  support_type text,
  support_score numeric(5,4),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  agent_type text not null,
  route_id uuid default gen_random_uuid(),
  model_id text not null,
  provider text not null default 'nvidia',
  prompt_version text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  estimated_cost numeric,
  status text not null,
  created_at timestamptz not null default now()
);

create table public.router_decisions (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references public.ai_runs(id) on delete cascade,
  required_capabilities_json jsonb not null default '[]'::jsonb,
  candidate_models_json jsonb not null default '[]'::jsonb,
  selected_model text not null,
  fallback_models_json jsonb not null default '[]'::jsonb,
  selection_reason_json jsonb not null default '[]'::jsonb,
  policy_version text not null,
  registry_version text,
  created_at timestamptz not null default now()
);

create table public.model_registry (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_id text not null unique,
  enabled boolean not null default false,
  developer_company text not null,
  country_of_headquarters text not null,
  china_origin_excluded boolean not null default false,
  origin_reviewed_at timestamptz,
  approved_provider boolean not null default false,
  approved_model boolean not null default false,
  allowed_for_student_data boolean not null default false,
  training_on_api_data boolean,
  zero_data_retention_available boolean,
  security_review_passed boolean not null default false,
  security_reviewed_at timestamptz,
  privacy_policy_verified boolean not null default false,
  privacy_reviewed_at timestamptz,
  released_at timestamptz,
  deprecated boolean not null default false,
  capabilities_json jsonb not null default '{}'::jsonb,
  limits_json jsonb not null default '{}'::jsonb,
  evaluation_profile_json jsonb not null default '{}'::jsonb,
  production_approved boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.university_evaluation_profiles (
  id uuid primary key default gen_random_uuid(),
  university text not null,
  admission_year integer not null,
  track text not null,
  evaluation_dimensions_json jsonb not null default '[]'::jsonb,
  source_url text not null,
  retrieved_at timestamptz not null,
  official boolean not null default true,
  unique (university, admission_year, track)
);

create index assignments_user_id_idx on public.assignments(user_id);
create index curriculum_assignment_idx on public.curriculum_context(assignment_id);
create index rubric_assignment_idx on public.rubric_items(assignment_id);
create index sources_assignment_idx on public.sources(assignment_id);
create index drafts_assignment_idx on public.drafts(assignment_id);
create index claims_assignment_idx on public.claims(assignment_id);
create index evidence_claim_idx on public.evidence(claim_id);
create index ai_runs_assignment_idx on public.ai_runs(assignment_id);

alter table public.assignments enable row level security;
alter table public.curriculum_context enable row level security;
alter table public.rubric_items enable row level security;
alter table public.sources enable row level security;
alter table public.drafts enable row level security;
alter table public.verification_results enable row level security;
alter table public.claims enable row level security;
alter table public.evidence enable row level security;
alter table public.ai_runs enable row level security;
alter table public.router_decisions enable row level security;
alter table public.model_registry enable row level security;
alter table public.university_evaluation_profiles enable row level security;

-- 신규 프로젝트에서는 public 테이블의 Data API 권한이 자동 부여되지 않을 수 있으므로 명시적으로 설정한다.
revoke all on table public.assignments from anon, authenticated;
revoke all on table public.curriculum_context from anon, authenticated;
revoke all on table public.rubric_items from anon, authenticated;
revoke all on table public.sources from anon, authenticated;
revoke all on table public.drafts from anon, authenticated;
revoke all on table public.verification_results from anon, authenticated;
revoke all on table public.claims from anon, authenticated;
revoke all on table public.evidence from anon, authenticated;
revoke all on table public.ai_runs from anon, authenticated;
revoke all on table public.router_decisions from anon, authenticated;
revoke all on table public.model_registry from anon, authenticated;
revoke all on table public.university_evaluation_profiles from anon, authenticated;

grant select, insert, update, delete on table
  public.assignments,
  public.curriculum_context,
  public.rubric_items,
  public.sources,
  public.drafts,
  public.verification_results,
  public.claims,
  public.evidence
  to authenticated;

grant select, insert, update, delete on table
  public.assignments,
  public.curriculum_context,
  public.rubric_items,
  public.sources,
  public.drafts,
  public.verification_results,
  public.claims,
  public.evidence,
  public.ai_runs,
  public.router_decisions,
  public.model_registry,
  public.university_evaluation_profiles
  to service_role;

create policy "assignments_select_own" on public.assignments for select to authenticated using ((select auth.uid()) = user_id);
create policy "assignments_insert_own" on public.assignments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "assignments_update_own" on public.assignments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "assignments_delete_own" on public.assignments for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.owns_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.assignments a
    where a.id = target_assignment_id and a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.owns_assignment(uuid) from public;
grant execute on function public.owns_assignment(uuid) to authenticated;

create policy "curriculum_own" on public.curriculum_context for all to authenticated using (public.owns_assignment(assignment_id)) with check (public.owns_assignment(assignment_id));
create policy "rubric_own" on public.rubric_items for all to authenticated using (public.owns_assignment(assignment_id)) with check (public.owns_assignment(assignment_id));
create policy "sources_own" on public.sources for all to authenticated using (public.owns_assignment(assignment_id)) with check (public.owns_assignment(assignment_id));
create policy "drafts_own" on public.drafts for all to authenticated using (public.owns_assignment(assignment_id)) with check (public.owns_assignment(assignment_id));
create policy "claims_own" on public.claims for all to authenticated using (public.owns_assignment(assignment_id)) with check (public.owns_assignment(assignment_id));

create policy "verification_own" on public.verification_results for all to authenticated
using (exists (select 1 from public.drafts d where d.id = draft_id and public.owns_assignment(d.assignment_id)))
with check (exists (select 1 from public.drafts d where d.id = draft_id and public.owns_assignment(d.assignment_id)));

create policy "evidence_own" on public.evidence for all to authenticated
using (exists (select 1 from public.claims c where c.id = claim_id and public.owns_assignment(c.assignment_id)))
with check (exists (select 1 from public.claims c where c.id = claim_id and public.owns_assignment(c.assignment_id)));

-- AI 실행/라우팅 이력과 모델 레지스트리, 대학 평가 프로필은 서버 전용(service_role)으로 유지한다.
-- Storage bucket 'assignment-files'는 Storage API 또는 Dashboard에서 private으로 생성한다.
-- 객체 경로는 `${auth.uid()}/...` 형식을 강제한다.
create policy "assignment_files_select_own" on storage.objects for select to authenticated
using (bucket_id = 'assignment-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "assignment_files_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'assignment-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "assignment_files_update_own" on storage.objects for update to authenticated
using (bucket_id = 'assignment-files' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'assignment-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "assignment_files_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'assignment-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
