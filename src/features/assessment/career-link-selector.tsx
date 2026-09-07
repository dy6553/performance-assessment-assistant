"use client";

import { useId } from "react";

import type { AssignmentInput } from "./schemas";

export function CareerLinkSelector({ value, onChange, disabled = false }: {
  value: AssignmentInput["careerLinked"];
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const titleId = useId();

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p id={titleId} className="text-sm font-black text-slate-900">진로 연계</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">O를 선택한 경우에만 진로 정보 세부사항이 표시됩니다.</p>
        </div>
        <div className="grid min-w-36 grid-cols-2 gap-2" role="group" aria-labelledby={titleId}>
          <button type="button" aria-pressed={value === true} disabled={disabled} onClick={() => onChange(true)}
            className={`min-h-11 rounded-xl border px-4 text-sm font-black transition disabled:opacity-60 ${value === true ? "border-violet-600 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}>O</button>
          <button type="button" aria-pressed={value === false} disabled={disabled} onClick={() => onChange(false)}
            className={`min-h-11 rounded-xl border px-4 text-sm font-black transition disabled:opacity-60 ${value === false ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"}`}>X</button>
        </div>
      </div>

      {value === true ? (
        <div className="mt-4 border-t border-violet-100 pt-4">
          <p className="text-xs font-semibold leading-5 text-slate-600">
            내 계정에 저장한 관심 분야·희망 학과·희망 직업을 주제 추천·분석·작성·수정·검증·AI Chat에서 참고합니다.
          </p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-slate-500">
            교사 안내·평가기준·교과 적합성을 먼저 적용하고 자연스럽게 연결되는 경우에만 사용합니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}
