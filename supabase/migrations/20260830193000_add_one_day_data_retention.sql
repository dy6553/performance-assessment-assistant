-- 사용자 수행평가/AI 작업 데이터는 마지막 활동 기준 24시간 보관 후 자동 삭제한다.
-- 계정, 사용자 프로필, 학교 정보, 관리자 감사 로그, 모델 레지스트리는 유지한다.

create extension if not exists pg_cron;

create or replace function public.cleanup_expired_app_data_1d()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 수행평가를 삭제하면 FK ON DELETE CASCADE로 루브릭, 초안, 검증,
  -- 출처, 주장/근거, 해당 수행평가의 AI 실행/라우팅 기록도 함께 삭제된다.
  delete from public.assignments
  where coalesce(updated_at, created_at) < now() - interval '1 day';

  -- 수행평가와 연결되지 않은 AI 실행 기록도 24시간이 지나면 정리한다.
  delete from public.ai_runs
  where created_at < now() - interval '1 day';
end;
$$;

revoke all on function public.cleanup_expired_app_data_1d() from public;
revoke all on function public.cleanup_expired_app_data_1d() from anon, authenticated;
grant execute on function public.cleanup_expired_app_data_1d() to postgres, service_role;

-- 재적용 시 같은 이름의 기존 작업을 제거한 뒤 다시 등록한다.
do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'wanhee_cleanup_expired_app_data_1d'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end;
$$;

-- 매시간 7분에 정리한다. 따라서 만료 후 최대 약 1시간 안에 삭제된다.
select cron.schedule(
  'wanhee_cleanup_expired_app_data_1d',
  '7 * * * *',
  'select public.cleanup_expired_app_data_1d();'
);
