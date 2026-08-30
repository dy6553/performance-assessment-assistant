import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/login/actions";
import { ProfileForm } from "@/features/auth/profile-form";
import { getAuthenticatedUser } from "@/lib/supabase/server/auth";
import { getCurrentUserProfile } from "@/lib/supabase/server/profile";

export default async function AccountPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account");

  const profile = await getCurrentUserProfile();
  const fallbackNickname =
    typeof user.user_metadata?.nickname === "string" && user.user_metadata.nickname.trim()
      ? user.user_metadata.nickname.trim()
      : "학생";
  const nickname = profile?.nickname?.trim() || fallbackNickname;
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link className="text-sm font-black text-violet-700 hover:text-violet-900" href="/">
          ← 홈으로
        </Link>
        <p className="mt-6 text-sm font-black text-violet-700">내 계정</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">
          사용자 정보와 로그인
        </h1>
        <p className="mt-3 text-sm font-semibold leading-7 text-slate-600 sm:text-base">
          학교와 나이를 등록하고 계정별·학교별 수행평가 데이터를 분리해서 관리합니다.
        </p>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">사용자 정보</p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">{nickname}</h2>
          <p className="mt-3 break-all text-sm font-bold text-slate-600">{user.email ?? "이메일 정보 없음"}</p>

          <ProfileForm
            age={profile?.age ?? null}
            nickname={nickname}
            schoolName={profile?.school_name ?? ""}
          />
        </section>

        <div className="space-y-5">
          {isAdmin ? (
            <section className="rounded-[2rem] border border-violet-200 bg-violet-50 p-6 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">관리자 모드</p>
              <h2 className="mt-3 text-lg font-black text-violet-950">
                {profile.role === "SUPER_ADMIN" ? "최고 관리자" : "관리자"}
              </h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-violet-700">
                사용자, AI 모델, 인프라 상태와 감사 로그를 시험온 관리자 모드처럼 관리할 수 있습니다.
              </p>
              <Link className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-4 font-black text-white" href="/admin">
                관리자 모드 열기
              </Link>
            </section>
          ) : null}

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">데이터 분리</p>
            <h2 className="mt-3 text-lg font-black text-slate-950">학교별 작업 공간</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              수행평가 데이터는 사용자 계정과 현재 학교 범위를 함께 확인합니다. 학교를 변경하면 이전 학교의 작업은 현재 학교 화면에 섞이지 않습니다.
            </p>
            <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-bold text-slate-400">현재 학교</dt>
                <dd className="text-right font-black text-slate-800">{profile?.school_name || "미등록"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-bold text-slate-400">나이</dt>
                <dd className="text-right font-black text-slate-800">{profile?.age ? `${profile.age}세` : "미등록"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">계정 관리</p>
            <h2 className="mt-3 text-lg font-black text-slate-950">로그인 상태</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              세션이 만료되기 전에는 자동으로 갱신되어 로그인 상태를 유지합니다.
            </p>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-400">
              비밀번호와 세션 토큰은 이 화면에 표시하지 않습니다.
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
      </div>
    </main>
  );
}
