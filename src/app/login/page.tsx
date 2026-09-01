import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth/auth-form";
import { getAuthenticatedUser } from "@/lib/supabase/server/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  if (await getAuthenticatedUser()) redirect("/account");
  const { next, reason } = await searchParams;

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-7">
        <Link className="text-sm font-black text-violet-700 hover:text-violet-900" href="/">
          ← 홈으로
        </Link>
        <p className="mt-6 text-sm font-black text-violet-700">계정</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
          수행평가 도우미 로그인
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">
          시험온과 같은 방식으로 Supabase 계정에 로그인합니다. 로그인 상태는 안전한 세션 쿠키로 유지됩니다.
        </p>
      </header>

      {reason === "suspended" ? (
        <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-extrabold text-rose-700">
          관리자에 의해 사용이 정지된 계정입니다.
        </div>
      ) : null}

      <AuthForm nextPath={next ?? "/account"} />

      <form action="/developer-login" className="mt-6 text-center" method="get">
        <button
          className="min-h-12 rounded-2xl bg-violet-600 px-6 font-extrabold text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
          type="submit"
        >
          GPT 테스트용 개발자 계정
        </button>
      </form>
      <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
        회원가입 시 Supabase 설정에 따라 이메일 확인이 필요할 수 있습니다.
      </p>
    </main>
  );
}
