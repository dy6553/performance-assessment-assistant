"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { assessmentVerificationStorageKey } from "@/features/assessment/assessment-flow";
import type { DraftResult, VerificationResult } from "@/features/assessment/schemas";

type VerificationWithScore = VerificationResult & { readinessScore: number };

function readStorage<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function statusLabel(status: string) {
  if (status === "PASS") return "통과";
  if (status === "PARTIAL") return "부분 충족";
  if (status === "FAIL") return "수정 필요";
  return "웹 확인 필요";
}

export default function VerificationResultPage() {
  const [result, setResult] = useState<VerificationWithScore | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setResult(readStorage<VerificationWithScore>(assessmentVerificationStorageKey));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const revisedText = useMemo(() => {
    const draft: DraftResult | null = result?.revisedDraft ?? null;
    if (!draft) return "";
    return [draft.title, draft.thesisOrGoal, ...draft.sections.flatMap((section) => [section.heading, section.body])].join("\n\n");
  }, [result]);

  if (!result) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-5 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-xl font-black text-slate-950">검증 결과가 없습니다.</h1>
          <Link className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white" href="/assignment/draft">초안으로 돌아가기</Link>
        </div>
      </main>
    );
  }

  const checks = [
    ["요구조건", result.requirementCheck],
    ["교육과정", result.curriculumCheck],
    ["루브릭", result.rubricCheck],
    ["논리", result.logicCheck],
    ["사실·출처", result.factSourceCheck],
    ["형식·분량", result.formatCheck],
    ["학년 수준", result.gradeLevelCheck],
  ] as const;

  async function copyRevised() {
    if (revisedText) await navigator.clipboard.writeText(revisedText);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-32 pt-4 sm:px-6 sm:pt-6">
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-sky-700">독립 검증 결과</p>
            <div className="mt-0.5 flex items-end gap-2"><span className="text-3xl font-black tracking-[-0.05em] text-slate-950">{result.readinessScore}</span><span className="pb-1 text-xs font-bold text-slate-500">/100 제출 준비도</span></div>
          </div>
          {revisedText ? <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700" onClick={() => void copyRevised()} type="button">수정본 복사</button> : null}
        </div>
      </header>

      <article className="pt-5">
        <p className="text-[15px] font-semibold leading-7 text-slate-700">{result.summary}</p>
        <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
          {checks.map(([label, check]) => (
            <details className="py-3" key={label} open={check.status === "FAIL" || check.status === "PARTIAL"}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span className="font-black text-slate-900">{label}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{statusLabel(check.status)}</span>
              </summary>
              {check.evidence.length ? <CompactList label="판단 근거" items={check.evidence} /> : null}
              {check.issues.length ? <CompactList label="문제" items={check.issues} /> : null}
              {check.fixes.length ? <CompactList label="수정" items={check.fixes} /> : null}
            </details>
          ))}
        </div>

        {result.revisedDraft ? (
          <section className="mt-6">
            <p className="text-xs font-black text-emerald-700">검증 반영 수정본</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{result.revisedDraft.title}</h2>
            <p className="mt-2 border-l-4 border-emerald-400 pl-4 text-sm font-bold leading-6 text-slate-700">{result.revisedDraft.thesisOrGoal}</p>
            <div className="mt-5 space-y-5">
              {result.revisedDraft.sections.map((section, index) => (
                <section key={`${section.heading}-${index}`}>
                  <h3 className="mb-1.5 text-lg font-black text-slate-950">{section.heading}</h3>
                  <p className="whitespace-pre-wrap text-[15px] font-medium leading-7 text-slate-700">{section.body}</p>
                </section>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-7 rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-black text-violet-700">다음 단계 · 완성본</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">검증 결과를 바탕으로 최종 문서를 직접 수정할 수 있습니다.</h2>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">완성본에서도 AI 재실행·Chat 수정이 가능하고, 내용이 끝난 뒤 Word·한글·PDF·텍스트 형식을 선택합니다.</p>
        </section>
      </article>

      <nav className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.7rem)] z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-2">
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700" href="/assignment/draft">← 초안</Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700" href="/assignment/workspace">작성 전략</Link>
          <Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-3 text-sm font-black text-white" href="/assignment/final">완성본 만들기 →</Link>
        </div>
      </nav>
    </main>
  );
}

function CompactList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm font-medium leading-6 text-slate-600">{items.map((item, index) => <li key={`${label}-${index}`}>{item}</li>)}</ul>
    </div>
  );
}
