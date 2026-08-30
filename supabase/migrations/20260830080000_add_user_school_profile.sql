-- 사용자 프로필에 학교/나이를 저장하고 수행평가 데이터에 학교 범위를 추가한다.
-- 사용자별 RLS에 학교 키를 한 겹 더 적용해 같은 계정이 학교를 변경해도 이전 학교 데이터가 섞이지 않게 한다.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '학생',
  school_name text not null default '',
  school_key text not null default '',
  age smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_nickname_length check (char_length(trim(nickname)) between 1 and 30),
  constraint user_profiles_school_name_length check (char_length(school_name) <= 120),
  constraint user_profiles_age_range check (age is null or age between 6 and 100)
);

alter table public.user_profiles enable row level security;

revoke all on table public.user_profiles from anon, authenticated;
grant select on table public.user_profiles to authenticated;
grant select, insert, update, delete on table public.user_profiles to service_role;

drop policy if exists "user_profiles_select_own" on public.user_profiles;
create policy "user_profiles_select_own"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.normalize_school_name(value text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select lower(regexp_replace(trim(coalesce(value, '')), '\s+', '', 'g'));
$$;

revoke all on function public.normalize_school_name(text) from public;
grant execute on function public.normalize_school_name(text) to authenticated, service_role;

insert into public.user_profiles (user_id, nickname)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'nickname'), ''), '학생')
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, nickname)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), '학생')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

alter table public.assignments
  add column if not exists school_key text not null default '';

create index if not exists assignments_user_school_idx
  on public.assignments(user_id, school_key);

create or replace function public.current_school_key()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select p.school_key
    from public.user_profiles p
    where p.user_id = (select auth.uid())
  ), '');
$$;

revoke all on function public.current_school_key() from public;
grant execute on function public.current_school_key() to authenticated, service_role;

create or replace function public.set_my_profile(
  p_nickname text,
  p_school_name text,
  p_age integer
)
returns public.user_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid := (select auth.uid());
  cleaned_nickname text := trim(coalesce(p_nickname, ''));
  cleaned_school_name text := trim(coalesce(p_school_name, ''));
  next_school_key text;
  previous_school_key text := '';
  result_row public.user_profiles;
begin
  if target_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if char_length(cleaned_nickname) < 1 or char_length(cleaned_nickname) > 30 then
    raise exception 'INVALID_NICKNAME';
  end if;

  if char_length(cleaned_school_name) < 2 or char_length(cleaned_school_name) > 120 then
    raise exception 'INVALID_SCHOOL_NAME';
  end if;

  if p_age is null or p_age < 6 or p_age > 100 then
    raise exception 'INVALID_AGE';
  end if;

  next_school_key := public.normalize_school_name(cleaned_school_name);
  if next_school_key = '' then
    raise exception 'INVALID_SCHOOL_NAME';
  end if;

  select p.school_key
    into previous_school_key
  from public.user_profiles p
  where p.user_id = target_user_id;

  previous_school_key := coalesce(previous_school_key, '');

  -- 학교를 처음 등록하는 경우 기존 미분류 작업은 새 학교 범위로 옮긴다.
  -- 이후 학교를 변경하면 이전 학교 데이터는 그대로 남고 현재 학교에서는 보이지 않는다.
  if previous_school_key = '' and next_school_key <> '' then
    update public.assignments
      set school_key = next_school_key
    where user_id = target_user_id
      and school_key = '';
  end if;

  insert into public.user_profiles (
    user_id,
    nickname,
    school_name,
    school_key,
    age,
    updated_at
  )
  values (
    target_user_id,
    cleaned_nickname,
    cleaned_school_name,
    next_school_key,
    p_age::smallint,
    now()
  )
  on conflict (user_id) do update set
    nickname = excluded.nickname,
    school_name = excluded.school_name,
    school_key = excluded.school_key,
    age = excluded.age,
    updated_at = now()
  returning * into result_row;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('nickname', cleaned_nickname)
  where id = target_user_id;

  return result_row;
end;
$$;

revoke all on function public.set_my_profile(text, text, integer) from public;
grant execute on function public.set_my_profile(text, text, integer) to authenticated;

create or replace function public.stamp_assignment_school_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select coalesce(p.school_key, '')
    into new.school_key
  from public.user_profiles p
  where p.user_id = new.user_id;

  new.school_key := coalesce(new.school_key, '');
  return new;
end;
$$;

drop trigger if exists assignments_stamp_school_key on public.assignments;
create trigger assignments_stamp_school_key
before insert on public.assignments
for each row execute function public.stamp_assignment_school_key();

-- 기존 사용자 소유 정책을 사용자 + 현재 학교 범위 정책으로 강화한다.
drop policy if exists "assignments_select_own" on public.assignments;
drop policy if exists "assignments_insert_own" on public.assignments;
drop policy if exists "assignments_update_own" on public.assignments;
drop policy if exists "assignments_delete_own" on public.assignments;

create policy "assignments_select_own_school"
on public.assignments for select to authenticated
using (
  (select auth.uid()) = user_id
  and school_key = public.current_school_key()
);

create policy "assignments_insert_own_school"
on public.assignments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and school_key = public.current_school_key()
);

create policy "assignments_update_own_school"
on public.assignments for update to authenticated
using (
  (select auth.uid()) = user_id
  and school_key = public.current_school_key()
)
with check (
  (select auth.uid()) = user_id
  and school_key = public.current_school_key()
);

create policy "assignments_delete_own_school"
on public.assignments for delete to authenticated
using (
  (select auth.uid()) = user_id
  and school_key = public.current_school_key()
);

create or replace function public.owns_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = target_assignment_id
      and a.user_id = (select auth.uid())
      and a.school_key = public.current_school_key()
  );
$$;

revoke all on function public.owns_assignment(uuid) from public;
grant execute on function public.owns_assignment(uuid) to authenticated;
