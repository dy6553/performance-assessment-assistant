import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/login/actions";
import { getAuthenticatedUser } from "@/lib/supabase/server/auth";

export default async function AccountPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account");

  const nickname =
    typeof user.user_metadata?.nickname === "string" && user.user_metadata.nickname.trim()
      ? user.user_metadata.nickname.trim()
      : "학생";

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link className="text-sm font-black text-violet-700 hover:text-violet-900" href="/">
          ← 홈으로
        </Link>
        <p className="mt-6 text-sm font-black text-violet-700">내 계정</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
          프로필과 로그인
        </h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">
          로그인 정보를 확인하고 현재 기기에서 로그아웃할 수 있습니다.
        </p>
      </header>

      <div className="mt-7 grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">프로필</p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">{nickname}</h2>
          <p className="mt-4 break-all text-sm font-bold text-slate-600">{user.email ?? "이메일 정보 없음"}</p>
          <p className="mt-4 text-xs font-semibold leading-5 text-slate-400">
            비밀번호와 세션 토큰은 이 화면에 표시하지 않습니다.
          </p>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">계정 관리</p>
          <h2 className="mt-3 text-lg font-black text-slate-950">로그인 상태</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            세션이 만료되기 전에는 자동으로 갱신되어 로그인 상태를 유지합니다.
          </p>
          <form action={logoutAction} className="mt-6">
            <button
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-black text-slate-700 transition hover:bg-slate-100"
              type="submit"
            >
              로그아웃
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
