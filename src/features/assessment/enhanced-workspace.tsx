"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { readApiResponse } from "@/lib/http/client-response";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
} from "./assessment-flow";
import {
  assessmentExecutionPlanStorageKey,
  assessmentResearchSourceNotesStorageKey,
  assessmentResearchStorageKey,
} from "./stage-flow";
import type { AnalysisResult, AssignmentInput, DraftResult, VerificationResult } from "./schemas";
import type { ExecutionPlanResult, ResearchResult } from "./stage-schemas";

type VerificationWithScore = VerificationResult & { readinessScore: number };
type RouteMeta = { model: string; fallback: string | null; reason: string };

export function EnhancedAssessmentWorkspace() {
  const [assignment, setAssignment] = useState<AssignmentInput | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [plan, setPlan] = useState<ExecutionPlanResult | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [verification, setVerification] = useState<VerificationWithScore | null>(null);
  const [sourceNotes, setSourceNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setAssignment(readSession<AssignmentInput>(assessmentFlowStorageKey));
      setAnalysis(readSession<AnalysisResult>(assessmentAnalysisStorageKey));
      setResearch(readSession<ResearchResult>(assessmentResearchStorageKey));
      setPlan(readSession<ExecutionPlanResult>(assessmentExecutionPlanStorageKey));
      setDraft(readSession<DraftResult>(assessmentDraftStorageKey));
      setVerification(readSession<VerificationWithScore>(assessmentVerificationStorageKey));
      setSourceNotes(readSession<string>(assessmentResearchSourceNotesStorageKey) ?? "");
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const draftText = useMemo(
    () => draft?.sections.map((section) => `${section.heading}\n${section.body}`).join("\n\n") ?? "",
    [draft],
  );

  function updateSourceNotes(value: string) {
    setSourceNotes(value);
    writeSession(assessmentResearchSourceNotesStorageKey, value);
    if (research || plan || draft || verification) {
      setResearch(null);
      setPlan(null);
      setDraft(null);
      setVerification(null);
      removeSession(assessmentResearchStorageKey);
      removeSession(assessmentExecutionPlanStorageKey);
      removeSession(assessmentDraftStorageKey);
      removeSession(assessmentVerificationStorageKey);
    }
  }

  async function runResearch() {
    if (!assignment || !analysis) return;
    setLoading("자료 URL을 확인하고 학술자료 후보와 근거 공백을 분석하고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, sourceNotes }),
      });
      const payload = await readApiResponse<{ data?: ResearchResult; route?: RouteMeta; error?: string }>(
        response,
        "자료 조사·출처 검증 결과를 만들지 못했습니다.",
      );
      if (!response.ok || !payload.data) throw new Error(payload.error || "자료 조사·출처 검증 결과를 만들지 못했습니다.");
      setResearch(payload.data);
      setPlan(null);
      setDraft(null);
      setVerification(null);
      writeSession(assessmentResearchStorageKey, payload.data);
      removeSession(assessmentExecutionPlanStorageKey);
      removeSession(assessmentDraftStorageKey);
      removeSession(assessmentVerificationStorageKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "자료 조사·출처 검증 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function runPlan() {
    if (!assignment || !analysis || !research) return;
    setLoading("자료검증 결과를 바탕으로 수행 방법과 목차를 설계하고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, research }),
      });
      const payload = await readApiResponse<{ data?: ExecutionPlanResult; route?: RouteMeta; error?: string }>(
        response,
        "수행 설계 결과를 만들지 못했습니다.",
      );
      if (!response.ok || !payload.data) throw new Error(payload.error || "수행 설계 결과를 만들지 못했습니다.");
      setPlan(payload.data);
      setDraft(null);
      setVerification(null);
      writeSession(assessmentExecutionPlanStorageKey, payload.data);
      removeSession(assessmentDraftStorageKey);
      removeSession(assessmentVerificationStorageKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "수행 설계 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function generate() {
    if (!assignment || !analysis || !research || !plan) {
      setError("자료검증과 수행설계를 먼저 완료해 주세요.");
      return;
    }
    setLoading("검증된 자료 상태와 수행설계를 바탕으로 초안을 만들고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, research, plan }),
      });
      const payload = await readApiResponse<{ data?: DraftResult; route?: RouteMeta; error?: string }>(response, "초안을 만들지 못했습니다.");
      if (!response.ok || !payload.data) throw new Error(payload.error || "초안을 만들지 못했습니다.");
      setDraft(payload.data);
      setVerification(null);
      writeSession(assessmentDraftStorageKey, payload.data);
      removeSession(assessmentVerificationStorageKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 작성 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function verify() {
    if (!assignment || !analysis || !draft) return;
    setLoading("루브릭·논리·사실과 출처를 최종 검증하고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, draft }),
      });
      const payload = await readApiResponse<{ data?: VerificationWithScore; route?: RouteMeta; error?: string }>(response, "초안을 검증하지 못했습니다.");
      if (!response.ok || !payload.data) throw new Error(payload.error || "초안을 검증하지 못했습니다.");
      setVerification(payload.data);
      writeSession(assessmentVerificationStorageKey, payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검증 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  if (!hydrated) return <LoadingCard text="수행평가 진행 내용을 불러오는 중입니다." />;
  if (!assignment || !analysis) {
    return (
      <main className="mx-auto min-h-[70dvh] max-w-5xl px-4 py-8 sm:px-6">
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-black text-slate-950">먼저 과제 분석을 완료해 주세요.</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">주제 확정 후 최종 확인 페이지에서 분석을 시작하면 이 단계로 이어집니다.</p>
          <Link className={`${primaryButtonClass} mt-5`} href="/assignment/review">최종 확인으로 이동</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm font-black text-violet-700" href="/assignment/review">← 입력 내용</Link>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{assignment.subject} · {assignment.topic}</span>
      </div>
      <StageProgress hasResearch={Boolean(research)} hasPlan={Boolean(plan)} hasDraft={Boolean(draft)} hasVerification={Boolean(verification)} />

      <section className="mt-6 rounded-[2rem] border border-violet-200 bg-violet-50/60 p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">1. 작성 전략 분석 완료</p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">{analysis.taskType.primary}</h1>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ResultCard title="가장 중요한 것" items={analysis.strategy.important} />
          <ResultCard title="감점 위험" items={analysis.strategy.deductionRisks} />
          <ResultCard title="추천 구조" items={analysis.strategy.recommendedStructure} ordered />
          <ResultCard title="평가기준별 전략" items={analysis.strategy.rubricStrategies} />
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-sky-200 bg-sky-50/60 p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">2. 자료조사·출처검증</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">근거를 먼저 확인합니다</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">이미 찾은 자료 URL을 붙여넣으면 서버가 실제 접속 여부와 페이지 메타데이터를 확인합니다. URL이 없어도 Crossref에서 학술자료 후보를 찾아 근거 공백과 검색어를 설계합니다.</p>
        <textarea
          className="mt-4 min-h-28 w-full resize-y rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-800 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          onChange={(event) => updateSourceNotes(event.target.value)}
          placeholder="이미 확보한 자료명·URL·메모를 붙여넣으세요. 예: https://... (없으면 비워도 됩니다)"
          value={sourceNotes}
        />
        <div className="mt-4 flex justify-end">
          <button className={primaryButtonClass} disabled={Boolean(loading)} onClick={() => void runResearch()} type="button">
            {research ? "자료검증 다시 실행" : "자료검증 실행"}
          </button>
        </div>

        {research ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-slate-700">{research.summary}</p>
            {research.liveSourceChecks.length ? (
              <div>
                <h3 className="text-sm font-black text-slate-900">실제 URL 확인 결과</h3>
                <div className="mt-2 grid gap-2">
                  {research.liveSourceChecks.map((source, index) => (
                    <div className="rounded-2xl border border-sky-100 bg-white p-4" key={`${source.url}-${index}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={source.status} />
                        <p className="text-sm font-black text-slate-900">{source.title || source.label}</p>
                      </div>
                      <p className="mt-2 break-all text-xs font-semibold text-slate-500">{source.url}</p>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{source.notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {research.academicCandidates.length ? (
              <ResultCard
                title="Crossref에서 실제 발견된 학술자료 후보"
                items={research.academicCandidates.map((item) => `${item.title}${item.year ? ` (${item.year})` : ""}${item.doi ? ` · DOI ${item.doi}` : ""}`)}
              />
            ) : null}
            <ResultCard title="근거별 확인 상태" items={research.evidenceNeeds.map((item) => `[${item.status}] ${item.claimOrQuestion} — ${item.notes}`)} />
            {research.gaps.length ? <ResultCard title="아직 남은 근거 공백" items={research.gaps} /> : null}
            <ResultCard title="다음 행동" items={research.nextActions} ordered />
          </div>
        ) : null}
      </section>

      <section className={`mt-6 rounded-[2rem] border p-5 sm:p-7 ${research ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50 opacity-70"}`}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">3. 수행설계·목차</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">글을 쓰기 전에 수행 과정부터 확정합니다</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">자료검증 결과를 루브릭과 연결해 실제 수행 순서, 결과물 구조, 학생이 직접 해야 할 일을 정합니다.</p>
        <div className="mt-4 flex justify-end">
          <button className={primaryButtonClass} disabled={!research || Boolean(loading)} onClick={() => void runPlan()} type="button">
            {plan ? "수행설계 다시 만들기" : "수행설계 만들기"}
          </button>
        </div>
        {plan ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-2xl bg-white p-4 text-sm font-bold leading-6 text-slate-800">핵심 질문: {plan.coreQuestion}</p>
            <ResultCard title="실제 수행 순서" items={plan.methodSteps} ordered />
            <ResultCard title="결과물 구조" items={plan.outline.map((item) => `${item.section} — ${item.purpose} / 학생 행동: ${item.studentAction}`)} ordered />
            <ResultCard title="평가기준 → 결과물 증거" items={plan.rubricMap.map((item) => `${item.criterion} → ${item.proofInOutput}`)} />
            {plan.requiredStudentInputs.length ? <ResultCard title="초안 전에 학생 입력이 필요한 것" items={plan.requiredStudentInputs} /> : null}
          </div>
        ) : null}
      </section>

      <section className={`mt-6 rounded-[2rem] border p-5 sm:p-7 ${plan ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50 opacity-70"}`}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">4. 초안 작성</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">검증된 근거 상태와 수행설계를 바탕으로 작성합니다</h2>
        <div className="mt-4 flex justify-end">
          <button className={primaryButtonClass} disabled={!plan || Boolean(loading)} onClick={() => void generate()} type="button">
            {draft ? "초안 다시 작성" : "초안 작성"}
          </button>
        </div>
        {draft ? (
          <div className="mt-5 rounded-[1.75rem] border border-emerald-100 bg-white p-5">
            <h3 className="text-2xl font-black text-slate-950">{draft.title}</h3>
            <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-900">핵심 목표: {draft.thesisOrGoal}</p>
            <article className="mt-5 space-y-5">
              {draft.sections.map((section, index) => (
                <div key={`${section.heading}-${index}`}>
                  <h4 className="font-black text-slate-900">{section.heading}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700">{section.body}</p>
                </div>
              ))}
            </article>
            {draft.sourceNeeds.length ? <ResultCard className="mt-5" title="추가 출처 확인 필요" items={draft.sourceNeeds} /> : null}
            {draft.uncertainties.length ? <ResultCard className="mt-4" title="확인 필요 내용" items={draft.uncertainties} /> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button className={primaryButtonClass} disabled={Boolean(loading)} onClick={() => void verify()} type="button">5. 최종 독립 검증</button>
              <CopyButton className={secondaryButtonClass} label="초안 복사" text={draftText} />
            </div>
          </div>
        ) : null}
      </section>

      {verification ? (
        <section className="mt-6 rounded-[2rem] border border-fuchsia-200 bg-fuchsia-50/60 p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-700">5. 최종 검증 완료</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-slate-950">제출 준비도 {verification.readinessScore}점</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{verification.summary}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["요구조건", verification.requirementCheck],
              ["루브릭", verification.rubricCheck],
              ["논리", verification.logicCheck],
              ["사실·출처", verification.factSourceCheck],
              ["형식", verification.formatCheck],
              ["학년 수준", verification.gradeLevelCheck],
            ].map(([label, check]) => (
              <div className="rounded-2xl bg-white p-4" key={label as string}>
                <p className="text-xs font-black text-slate-400">{label as string}</p>
                <p className="mt-1 text-sm font-black text-slate-900">{(check as VerificationResult["logicCheck"]).status}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {loading ? <p className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-black text-violet-700">{loading}</p> : null}
      {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
    </main>
  );
}

function StageProgress({ hasResearch, hasPlan, hasDraft, hasVerification }: { hasResearch: boolean; hasPlan: boolean; hasDraft: boolean; hasVerification: boolean }) {
  const labels = ["분석", "자료검증", "수행설계", "초안", "검증"];
  const active = hasVerification ? 4 : hasDraft ? 3 : hasPlan ? 2 : hasResearch ? 1 : 0;
  return (
    <div className="mt-5 grid grid-cols-5 gap-1.5" aria-label="작성 진행 단계">
      {labels.map((label, index) => (
        <div className={`rounded-xl px-1 py-2 text-center text-[11px] font-black sm:text-xs ${index <= active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-400"}`} key={label}>
          {index + 1}. {label}
        </div>
      ))}
    </div>
  );
}

function ResultCard({ title, items, ordered = false, className = "" }: { title: string; items: string[]; ordered?: boolean; className?: string }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`}>
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <Tag className={`mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600 ${ordered ? "list-decimal pl-5" : ""}`}>
        {items.length ? items.map((item, index) => <li className={ordered ? "" : "before:mr-2 before:content-['•']"} key={`${item}-${index}`}>{item}</li>) : <li>없음</li>}
      </Tag>
    </div>
  );
}

function StatusBadge({ status }: { status: ResearchResult["liveSourceChecks"][number]["status"] }) {
  const label = status === "VERIFIED" ? "접속 확인" : status === "REACHABLE_LIMITED" ? "접속만 확인" : status === "UNREACHABLE" ? "확인 실패" : "미제공";
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">{label}</span>;
}

function LoadingCard({ text }: { text: string }) {
  return (
    <main className="mx-auto min-h-[70dvh] max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm"><p className="text-sm font-black text-violet-700">{text}</p></div>
    </main>
  );
}

function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Keep the current in-memory state usable. */ }
}

function removeSession(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* Ignore restricted storage. */ }
}

const primaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-700 transition hover:border-violet-300 hover:text-violet-700";
