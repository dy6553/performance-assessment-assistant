"use client";

import type { AssignmentInput } from "./schemas";

export function CareerLinkSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: AssignmentInput["careerLinked"];
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5" aria-labelledby="career-link-title">
      <div>
        <p id="career-link-title" className="text-sm font-black text-slate-900">진로 연계</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">
          내 계정에 저장한 진로 정보를 이 수행평가의 주제 추천·분석·작성·수정·검증·AI Chat에 참고할지 선택하세요.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="진로 연계 O X 선택">
        <button
          type="button"
          aria-pressed={value === true}
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`min-h-16 rounded-2xl border px-3 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
            value === true
              ? "border-violet-600 bg-violet-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
          }`}
        >
          <span className="block text-xl font-black leading-none">O</span>
          <span className="mt-1 block text-xs font-black">진로 연계</span>
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`min-h-16 rounded-2xl border px-3 py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${
            value === false
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
          }`}
        >
          <span className="block text-xl font-black leading-none">X</span>
          <span className="mt-1 block text-xs font-black">연계 안 함</span>
        </button>
      </div>

      <p className="mt-3 text-[11px] font-semibold leading-5 text-slate-500">
        O를 선택해도 교사 안내·루브릭·교과 적합성이 항상 우선이며, 자연스럽게 연결될 때만 진로 정보를 사용합니다.
      </p>
    </section>
  );
}
