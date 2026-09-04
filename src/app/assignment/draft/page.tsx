"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
} from "@/features/assessment/assessment-flow";
import { CareerLinkStatusBadge } from "@/features/assessment/career-link-status-badge";
import type { AnalysisResult, AssignmentInput, DraftResult, VerificationResult } from "@/features/assessment/schemas";
import { readApiResponse } from "@/lib/http/client-response";

type VerificationWithScore = VerificationResult & { readinessScore: number };

function readStorage<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function DraftResultPage() {
  const router = useRouter();
  const [assignment, setAssignment] = useState<AssignmentInput | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAssignment(readStorage<AssignmentInput>(assessmentFlowStorageKey));
      setAnalysis(readStorage<AnalysisResult>(assessmentAnalysisStorageKey));
      setDraft(readStorage<DraftResult>(assessmentDraftStorageKey));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const draftText = useMemo(() => {
    if (!draft) return "";
    return [draft.title, draft.thesisOrGoal, ...draft.sections.flatMap((section) => [section.heading, section.body])].join("\n\n");
  }, [draft]);

  async function copyDraft() {
    if (!draftText) return;
    await navigator.clipboard.writeText(draftText);
  }

  async function verify() {
    if (!assignment || !analysis || !draft || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, draft }),
      });
      const payload = await readApiResponse<{ data?: VerificationWithScore; error?: string }>(response, "초안을 검증하지 못했습니다.");
      if (!response.ok || !payload.data) throw new Error(payload.error || "초안을 검증하지 못했습니다.");
      window.sessionStorage.setItem(assessmentVerificationStorageKey, JSON.stringify(payload.data));
      router.push("/assignment/verification");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검증 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  if (!draft) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-5 sm:px-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-xl font-black text-slate-950">초안 결과가 없습니다.</h1>
          <Link className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white" href="/assignment/workspace">작성 화면으로 돌아가기</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 pb-28 pt-4 sm:px-6 sm:pt-6">
      <header className="sticky top-0 z-20 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-700">수행평가 초안</p>
            <h1 className="truncate text-lg font-black text-slate-950">{draft.title}</h1>
            {assignment ? <div className="mt-1"><CareerLinkStatusBadge value={assignment.careerLinked} /></div> : null}
          </div>
          <button className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700" onClick={() => void copyDraft()} type="button">복사</button>
        </div>
      </header>

      <article className="pt-5 text-slate-800">
        <p className="mb-5 border-l-4 border-emerald-400 pl-4 text-sm font-bold leading-6 text-slate-700">{draft.thesisOrGoal}</p>
        <div className="space-y-5">
          {draft.sections.map((section, index) => (
            <section key={`${section.heading}-${index}`}>
              <h2 className="mb-1.5 text-lg font-black tracking-[-0.02em] text-slate-950">{section.heading}</h2>
              <p className="whitespace-pre-wrap text-[15px] font-medium leading-7 text-slate-700">{section.body}</p>
            </section>
          ))}
        </div>

        {draft.sourceNeeds.length ? (
          <details className="mt-6 rounded-xl border border-slate-200 px-4 py-3">
            <summary className="cursor-pointer text-sm font-black text-slate-800">추가 출처 확인 {draft.sourceNeeds.length}개</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{draft.sourceNeeds.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </details>
        ) : null}
        {draft.uncertainties.length ? (
          <details className="mt-3 rounded-xl border border-amber-200 px-4 py-3">
            <summary className="cursor-pointer text-sm font-black text-amber-800">확인되지 않은 내용 {draft.uncertainties.length}개</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">{draft.uncertainties.map((item, index) => <li key={index}>{item}</li>)}</ul>
          </details>
        ) : null}
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
      </article>

      <nav className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.7rem)] z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Link className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700" href="/assignment/workspace">← 전략</Link>
          <button className="inline-flex min-h-11 flex-[1.5] items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-black text-white disabled:opacity-50" disabled={loading} onClick={() => void verify()} type="button">{loading ? "검증 중..." : "독립 검증 →"}</button>
        </div>
      </nav>
    </main>
  );
}
