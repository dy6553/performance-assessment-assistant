import Link from "next/link";
import { redirect } from "next/navigation";

import { logoutAction } from "@/app/login/actions";
import { ProfileForm } from "@/features/auth/profile-form";
import { readSharedPersonalization } from "@/lib/personalization/shared-server";
import { getAuthenticatedUser } from "@/lib/supabase/server/auth";
import { getCurrentUserProfile } from "@/lib/supabase/server/profile";

export default async function AccountPage() {
  const [user, profile, sharedPersonalization] = await Promise.all([
    getAuthenticatedUser(),
    getCurrentUserProfile(),
    readSharedPersonalization(),
  ]);
  if (!user) redirect("/login?next=/account");

  const fallbackNickname =
    typeof user.user_metadata?.nickname === "string" && user.user_metadata.nickname.trim()
      ? user.user_metadata.nickname.trim()
      : "학생";
  const nickname = profile?.nickname?.trim() || fallbackNickname;
  const isAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN";
  const hasCareerInfo = Boolean(
    profile?.career_interest?.trim() ||
    profile?.desired_major?.trim() ||
    profile?.desired_career?.trim() ||
    profile?.career_notes?.trim(),
  );

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
          학교·나이·기본 교과서 출판사와 진로 정보를 저장합니다. 진로 반영 여부는 수행평가 작업을 시작할 때마다 선택합니다.
        </p>
      </header>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">사용자 정보</p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">{nickname}</h2>
          <p className="mt-3 break-all text-sm font-bold text-slate-600">{user.email ?? "이메일 정보 없음"}</p>

          <ProfileForm
            age={profile?.age ?? null}
            careerInterest={profile?.career_interest ?? ""}
            careerNotes={profile?.career_notes ?? ""}
            defaultPublisher={sharedPersonalization?.defaultPublisher ?? ""}
            desiredCareer={profile?.desired_career ?? ""}
            desiredMajor={profile?.desired_major ?? ""}
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

          <section className="rounded-[2rem] border border-violet-200 bg-violet-50/70 p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">진로 정보</p>
            <h2 className="mt-3 text-lg font-black text-violet-950">저장된 진로 정보</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-violet-700">
              {hasCareerInfo
                ? "진로 정보가 저장되어 있습니다. 실제 반영 여부는 새 수행평가 작업에서 O 또는 X로 선택합니다."
                : "진로 정보를 입력하면 수행평가 주제와 탐구 방향을 진로와 자연스럽게 연결할 수 있습니다."}
            </p>
            <dl className="mt-5 space-y-3 rounded-2xl bg-white p-4 text-sm">
              <InfoRow label="관심 분야" value={profile?.career_interest || "미등록"} />
              <InfoRow label="희망 전공" value={profile?.desired_major || "미등록"} />
              <InfoRow label="희망 진로" value={profile?.desired_career || "미등록"} />
            </dl>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">교과서 기본값</p>
            <h2 className="mt-3 text-lg font-black text-slate-950">기본 출판사</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              시험온과 수행도우미가 같은 계정에서 공유합니다. 과목별 내 교과서에 다른 출판사를 등록하면 해당 과목 설정이 우선합니다.
            </p>
            <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <InfoRow label="출판사" value={sharedPersonalization?.defaultPublisher || "미등록"} />
            </dl>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">데이터 분리</p>
            <h2 className="mt-3 text-lg font-black text-slate-950">학교별 작업 공간</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              수행평가 데이터는 사용자 계정과 현재 학교 범위를 함께 확인합니다. 학교를 변경하면 이전 학교의 작업은 현재 학교 화면에 섞이지 않습니다.
            </p>
            <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <InfoRow label="현재 학교" value={profile?.school_name || "미등록"} />
              <InfoRow label="나이" value={profile?.age ? `${profile.age}세` : "미등록"} />
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
              <button className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 font-black text-slate-700 transition hover:bg-slate-100" type="submit">
                로그아웃
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="font-bold text-slate-400">{label}</dt>
      <dd className="max-w-[65%] text-right font-black text-slate-800">{value}</dd>
    </div>
  );
}
