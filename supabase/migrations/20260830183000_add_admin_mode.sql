-- 시험온 관리자 모드와 같은 역할·상태·감사 로그 기반을 수행평가 도우미에 추가한다.

alter table public.user_profiles
  add column if not exists role text not null default 'USER',
  add column if not exists account_status text not null default 'ACTIVE',
  add column if not exists last_login_at timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists login_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_role_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_role_check
      check (role in ('USER', 'ADMIN', 'SUPER_ADMIN'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'user_profiles_account_status_check'
  ) then
    alter table public.user_profiles
      add constraint user_profiles_account_status_check
      check (account_status in ('ACTIVE', 'LIMITED', 'SUSPENDED'));
  end if;
end $$;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_target_type_check
    check (target_type in ('USER', 'AI_MODEL', 'SERVICE', 'SYSTEM', 'ADMIN'))
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_admin_user_idx
  on public.admin_audit_logs(admin_user_id, created_at desc);

alter table public.admin_audit_logs enable row level security;
revoke all on table public.admin_audit_logs from anon, authenticated;
grant select, insert, update, delete on table public.admin_audit_logs to service_role;

-- 관리자 페이지는 서버의 service-role 키를 통해서만 데이터를 조회·수정한다.
-- 초기 설치 시 사용자가 정확히 한 명뿐이면 그 계정을 최초 SUPER_ADMIN으로 지정한다.
do $$
declare
  user_count integer;
  first_user_id uuid;
begin
  select count(*) into user_count from auth.users;
  if user_count = 1 then
    select id into first_user_id from auth.users order by created_at asc limit 1;
    update public.user_profiles
      set role = 'SUPER_ADMIN', account_status = 'ACTIVE', updated_at = now()
    where user_id = first_user_id;
  end if;
end $$;
