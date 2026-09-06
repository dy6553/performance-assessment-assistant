"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { saveProfileAction, type ProfileFormState } from "@/app/account/actions";
import { assessmentStorageBaseKeys } from "@/features/assessment/assessment-flow";

const initialState: ProfileFormState = { message: "" };

export function ProfileForm({
  nickname,
  schoolName,
  age,
  careerInterest,
  desiredMajor,
  desiredCareer,
  careerNotes,
}: {
  nickname: string;
  schoolName: string;
  age: number | null;
  careerInterest: string;
  desiredMajor: string;
  desiredCareer: string;
  careerNotes: string;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveProfileAction, initialState);

  useEffect(() => {
    if (!state.success) return;

    if (state.schoolScopeChanged) {
      try {
        for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
          const key = window.sessionStorage.key(index);
          if (!key) continue;
          if (assessmentStorageBaseKeys.some((baseKey) => key === baseKey || key.startsWith(`${baseKey}::`))) {
            window.sessionStorage.removeItem(key);
          }
        }
      } catch {
        // 저장소 접근이 제한되어도 프로필 저장 자체는 유지한다.
      }
    }

    router.refresh();
  }, [router, state.schoolScopeChanged, state.success]);

  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">닉네임</span>
        <input className={inputClass} defaultValue={nickname} maxLength={30} name="nickname" placeholder="사용할 닉네임" required />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">학교</span>
        <input className={inputClass} defaultValue={schoolName} maxLength={120} name="schoolName" placeholder="예: 서울 OO고등학교" required />
        <span className="mt-2 block text-xs font-semibold leading-5 text-slate-400">학교 이름을 기준으로 수행평가 작업 공간을 분리합니다.</span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">나이</span>
        <input className={inputClass} defaultValue={age ?? ""} inputMode="numeric" max={100} min={6} name="age" placeholder="예: 16" required type="number" />
      </label>

      <section className="rounded-3xl border border-violet-100 bg-violet-50/60 p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">진로 관련 정보</p>
        <h3 className="mt-2 text-lg font-black text-violet-950">수행평가에 참고할 진로 정보</h3>
        <p className="mt-2 text-xs font-semibold leading-5 text-violet-700">
          입력은 선택 사항입니다. 저장한 뒤 각 수행평가 작업을 시작할 때 진로 정보 반영 여부를 직접 선택할 수 있습니다.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">관심 진로 분야</span>
            <input className={inputClass} defaultValue={careerInterest} maxLength={500} name="careerInterest" placeholder="예: 인공지능, 소프트웨어, 의학, 환경, 경제" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">희망 학과·전공</span>
            <input className={inputClass} defaultValue={desiredMajor} maxLength={300} name="desiredMajor" placeholder="예: 컴퓨터공학과, 생명과학과" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">희망 직업·진로</span>
            <input className={inputClass} defaultValue={desiredCareer} maxLength={300} name="desiredCareer" placeholder="예: AI 엔지니어, 의사, 연구원" />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">진로 관련 메모</span>
            <textarea className={`${inputClass} min-h-28 resize-y`} defaultValue={careerNotes} maxLength={1500} name="careerNotes" placeholder="관심 있는 세부 분야, 해 보고 싶은 탐구, 진로와 연결하고 싶은 방향 등을 적어 주세요." />
          </label>

          <p className="rounded-2xl border border-violet-200 bg-white p-4 text-xs font-bold leading-6 text-violet-800">진로 정보 사용 여부는 계정 설정이 아니라 새 수행평가의 ‘진로 연계 O / X’에서 작업별로 선택합니다.</p>
        </div>
      </section>

      <p aria-live="polite" className={`min-h-6 text-sm font-bold ${state.success ? "text-emerald-700" : "text-rose-700"}`}>
        {state.message}
      </p>

      <button className="min-h-12 w-full rounded-2xl bg-violet-700 px-5 font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "저장 중…" : "사용자 정보 저장"}
      </button>

      <p className="text-xs font-semibold leading-5 text-slate-400">학교를 변경하면 현재 학교 공간에서는 이전 학교의 수행평가 데이터가 표시되지 않습니다.</p>
    </form>
  );
}

const inputClass =
  "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
