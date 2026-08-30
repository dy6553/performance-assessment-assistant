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
}: {
  nickname: string;
  schoolName: string;
  age: number | null;
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
        <input
          className={inputClass}
          defaultValue={nickname}
          maxLength={30}
          name="nickname"
          placeholder="사용할 닉네임"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">학교</span>
        <input
          className={inputClass}
          defaultValue={schoolName}
          maxLength={120}
          name="schoolName"
          placeholder="예: 서울 OO고등학교"
          required
        />
        <span className="mt-2 block text-xs font-semibold leading-5 text-slate-400">
          학교 이름을 기준으로 수행평가 작업 공간을 분리합니다.
        </span>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-slate-700">나이</span>
        <input
          className={inputClass}
          defaultValue={age ?? ""}
          inputMode="numeric"
          max={100}
          min={6}
          name="age"
          placeholder="예: 16"
          required
          type="number"
        />
      </label>

      <p
        aria-live="polite"
        className={`min-h-6 text-sm font-bold ${state.success ? "text-emerald-700" : "text-rose-700"}`}
      >
        {state.message}
      </p>

      <button
        className="min-h-12 w-full rounded-2xl bg-violet-700 px-5 font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "저장 중…" : "사용자 정보 저장"}
      </button>

      <p className="text-xs font-semibold leading-5 text-slate-400">
        학교를 변경하면 현재 학교 공간에서는 이전 학교의 수행평가 데이터가 표시되지 않습니다.
      </p>
    </form>
  );
}

const inputClass =
  "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
