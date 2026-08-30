-- 트리거용 SECURITY DEFINER 함수는 Data API에서 직접 실행할 수 없게 막는다.
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
revoke execute on function public.stamp_assignment_school_key() from public, anon, authenticated;

-- 프로필 저장 RPC는 로그인 사용자만 실행할 수 있다.
revoke execute on function public.set_my_profile(text, text, integer) from public, anon;
grant execute on function public.set_my_profile(text, text, integer) to authenticated;
