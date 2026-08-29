"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import type {
  AnalysisResult,
  AssignmentInput,
  DraftResult,
  VerificationResult,
} from "./schemas";

type RouteMeta = {
  model: string;
  fallback: string | null;
  reason: string;
  registryPolicy: string;
  liveCatalogChecked: boolean;
};

type VerificationWithScore = VerificationResult & { readinessScore: number };

type Step = "input" | "strategy" | "draft" | "verification";

const initialAssignment: AssignmentInput = {
  schoolYear: 2026,
  schoolLevel: "고등학교",
  grade: 1,
  subject: "통합사회",
  course: "",
  assignmentType: "자동 분석",
  topic: "",
  teacherInstruction: "",
  rubricText: "",
  achievementStandardText: "",
  requiredElements: "",
  lengthRule: "",
  formatRule: "",
  studentIdeas: "",
};

export function AssessmentClient() {
  const [assignment, setAssignment] = useState<AssignmentInput>(initialAssignment);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [verification, setVerification] = useState<VerificationWithScore | null>(null);
  const [routes, setRoutes] = useState<RouteMeta[]>([]);
  const [step, setStep] = useState<Step>("input");
  const [loading, setLoading] = useState<string>("");
  const [error, setError] = useState<string>("");

  const maxGrade = assignment.schoolLevel === "초등학교" ? 6 : 3;
  const draftText = useMemo(
    () => draft?.sections.map((section) => `${section.heading}\n${section.body}`).join("\n\n") ?? "",
    [draft],
  );

  function update<K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) {
    setAssignment((current) => ({ ...current, [key]: value }));
    setAnalysis(null);
    setDraft(null);
    setVerification(null);
    setStep("input");
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    if (!assignment.topic.trim() || assignment.teacherInstruction.trim().length < 2) {
      setError("주제와 교사 안내문을 입력해 주세요.");
      return;
    }
    setLoading("과제 요구사항과 작성 전략을 분석하고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment }),
      });
      const payload = (await response.json()) as {
        data?: AnalysisResult;
        route?: RouteMeta;
        error?: string;
      };
      if (!response.ok || !payload.data || !payload.route) {
        throw new Error(payload.error || "분석 결과를 만들지 못했습니다.");
      }
      setAnalysis(payload.data);
      setRoutes([payload.route]);
      setStep("strategy");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function generate() {
    if (!analysis) return;
    setLoading("승인한 전략을 바탕으로 초안을 작성하고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis }),
      });
      const payload = (await response.json()) as {
        data?: DraftResult;
        route?: RouteMeta;
        error?: string;
      };
      if (!response.ok || !payload.data || !payload.route) {
        throw new Error(payload.error || "초안을 만들지 못했습니다.");
      }
      setDraft(payload.data);
      setRoutes((current) => [...current, payload.route as RouteMeta]);
      setStep("draft");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 작성 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function verify() {
    if (!analysis || !draft) return;
    setLoading("요구조건·논리·사실/출처·루브릭을 독립 검증하고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, draft }),
      });
      const payload = (await response.json()) as {
        data?: VerificationWithScore;
        route?: RouteMeta;
        error?: string;
      };
      if (!response.ok || !payload.data || !payload.route) {
        throw new Error(payload.error || "초안을 검증하지 못했습니다.");
      }
      setVerification(payload.data);
      setRoutes((current) => [...current, payload.route as RouteMeta]);
      setStep("verification");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검증 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="space-y-8">
      <Progress step={step} />

      <form className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7" onSubmit={analyze}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">STEP 1</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">수행평가 정보를 입력하세요</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">교사 안내문과 실제 루브릭이 가장 높은 우선순위를 가집니다. 성취기준을 모르면 비워 두셔도 됩니다.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">개인정보 최소 입력</span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="학년도">
            <input className={inputClass} min={2015} max={2035} type="number" value={assignment.schoolYear} onChange={(event) => update("schoolYear", Number(event.target.value))} />
          </Field>
          <Field label="학교급">
            <select className={inputClass} value={assignment.schoolLevel} onChange={(event) => {
              const level = event.target.value as AssignmentInput["schoolLevel"];
              setAssignment((current) => ({ ...current, schoolLevel: level, grade: Math.min(current.grade, level === "초등학교" ? 6 : 3) }));
              setAnalysis(null); setDraft(null); setVerification(null); setStep("input");
            }}>
              <option>초등학교</option><option>중학교</option><option>고등학교</option>
            </select>
          </Field>
          <Field label="학년">
            <select className={inputClass} value={assignment.grade} onChange={(event) => update("grade", Number(event.target.value))}>
              {Array.from({ length: maxGrade }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
            </select>
          </Field>
          <Field label="수행평가 종류">
            <input className={inputClass} value={assignment.assignmentType} onChange={(event) => update("assignmentType", event.target.value)} placeholder="자동 분석 또는 조사 보고서" />
          </Field>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="교과">
            <input className={inputClass} value={assignment.subject} onChange={(event) => update("subject", event.target.value)} placeholder="예: 사회" />
          </Field>
          <Field label="과목명">
            <input className={inputClass} value={assignment.course} onChange={(event) => update("course", event.target.value)} placeholder="예: 통합사회2" />
          </Field>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="수행평가 주제">
            <input className={inputClass} value={assignment.topic} onChange={(event) => update("topic", event.target.value)} placeholder="예: 기후위기 대응 정책 비교" />
          </Field>
          <Field label="교사가 제시한 과제 설명">
            <textarea className={`${inputClass} min-h-36 resize-y`} value={assignment.teacherInstruction} onChange={(event) => update("teacherInstruction", event.target.value)} placeholder="안내문을 가능한 한 그대로 붙여 넣으세요." />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="평가 기준 / 루브릭 (권장)">
              <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.rubricText} onChange={(event) => update("rubricText", event.target.value)} placeholder="배점, 평가요소, 수행수준 등" />
            </Field>
            <Field label="성취기준 코드 또는 문구 (선택)">
              <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.achievementStandardText} onChange={(event) => update("achievementStandardText", event.target.value)} placeholder="모르면 비워 두세요. 임의 코드는 생성하지 않습니다." />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="필수 포함 요소"><input className={inputClass} value={assignment.requiredElements} onChange={(event) => update("requiredElements", event.target.value)} /></Field>
            <Field label="분량"><input className={inputClass} value={assignment.lengthRule} onChange={(event) => update("lengthRule", event.target.value)} placeholder="예: 1500~2000자" /></Field>
            <Field label="제출 형식"><input className={inputClass} value={assignment.formatRule} onChange={(event) => update("formatRule", event.target.value)} placeholder="예: 보고서 PDF" /></Field>
          </div>
          <Field label="학생의 주장 / 조사한 내용 (권장)">
            <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.studentIdeas} onChange={(event) => update("studentIdeas", event.target.value)} placeholder="본인의 생각을 적으면 AI가 임의로 입장을 바꾸지 않고 중심 내용으로 사용합니다." />
          </Field>
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
        {loading ? <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">{loading}</p> : null}

        <button className={primaryButtonClass} disabled={Boolean(loading)} type="submit">과제 분석하고 작성 전략 만들기</button>
      </form>

      {analysis ? (
        <section className="rounded-[2rem] border border-violet-200 bg-violet-50/60 p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">STEP 2 · 작성 전략</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black text-slate-950">{analysis.taskType.primary}</h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">분류 신뢰도 {Math.round(analysis.taskType.confidence * 100)}%</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{analysis.curriculum.version}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{analysis.curriculum.basis}</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ResultCard title="이 수행평가에서 가장 중요한 것" items={analysis.strategy.important} />
            <ResultCard title="평가기준별 전략" items={analysis.strategy.rubricStrategies} />
            <ResultCard title="추천 구조" items={analysis.strategy.recommendedStructure} ordered />
            <ResultCard title="감점 위험" items={analysis.strategy.deductionRisks} />
          </div>

          {analysis.warnings.length ? <ResultCard className="mt-4" title="확인 필요" items={analysis.warnings} /> : null}

          <button className={primaryButtonClass} disabled={Boolean(loading)} onClick={generate} type="button">이 전략으로 초안 작성</button>
        </section>
      ) : null}

      {draft ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">STEP 3 · 수행평가 초안</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950">{draft.title}</h2>
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-900">핵심 목표: {draft.thesisOrGoal}</p>
          <article className="mt-6 space-y-6">
            {draft.sections.map((section, index) => (
              <div key={`${section.heading}-${index}`}>
                <h3 className="text-lg font-black text-slate-900">{section.heading}</h3>
                <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-slate-700">{section.body}</p>
              </div>
            ))}
          </article>
          {draft.sourceNeeds.length ? <ResultCard className="mt-6" title="추가 출처 검증이 필요한 부분" items={draft.sourceNeeds} /> : null}
          {draft.uncertainties.length ? <ResultCard className="mt-4" title="확실히 검증되지 않은 내용" items={draft.uncertainties} /> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button className={primaryButtonClass} disabled={Boolean(loading)} onClick={verify} type="button">초안 독립 검증</button>
            <button className={secondaryButtonClass} onClick={() => navigator.clipboard.writeText(draftText)} type="button">초안 복사</button>
          </div>
        </section>
      ) : null}

      {verification ? <VerificationPanel result={verification} /> : null}

      {routes.length ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <summary className="cursor-pointer font-black text-slate-800">AI Router 실행 정보</summary>
          <div className="mt-4 space-y-3">
            {routes.map((route, index) => (
              <div className="rounded-xl bg-slate-50 p-3" key={`${route.model}-${index}`}>
                <p className="font-bold text-slate-800">{index + 1}단계 · {route.model}</p>
                <p className="mt-1 leading-6">{route.reason}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function Progress({ step }: { step: Step }) {
  const labels = ["입력", "전략", "초안", "검증"];
  const activeIndex = { input: 0, strategy: 1, draft: 2, verification: 3 }[step];
  return (
    <div className="grid grid-cols-4 gap-2" aria-label="진행 단계">
      {labels.map((label, index) => <div className={`rounded-xl px-2 py-2 text-center text-xs font-black ${index <= activeIndex ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-400"}`} key={label}>{index + 1}. {label}</div>)}
    </div>
  );
}

function VerificationPanel({ result }: { result: VerificationWithScore }) {
  const revisedDraftText = result.revisedDraft?.sections
    .map((section) => `${section.heading}\n${section.body}`)
    .join("\n\n");
  const checks = [
    ["요구조건", result.requirementCheck],
    ["교육과정", result.curriculumCheck],
    ["루브릭", result.rubricCheck],
    ["논리", result.logicCheck],
    ["사실·출처", result.factSourceCheck],
    ["형식·분량", result.formatCheck],
    ["학년 수준", result.gradeLevelCheck],
  ] as const;
  return (
    <section className="rounded-[2rem] border border-sky-200 bg-sky-50/60 p-5 sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">STEP 4 · 검증 보고서</p>
      <div className="mt-3 flex items-end gap-3"><span className="text-5xl font-black tracking-[-0.06em] text-slate-950">{result.readinessScore}</span><span className="pb-1 text-sm font-bold text-slate-500">/ 100 제출 준비도</span></div>
      <p className="mt-3 text-sm leading-6 text-slate-600">{result.summary}</p>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {checks.map(([label, check]) => (
          <div className="rounded-2xl border border-white bg-white/90 p-4" key={label}>
            <div className="flex items-center justify-between gap-3"><h3 className="font-black text-slate-900">{label}</h3><StatusBadge status={check.status} /></div>
            {check.evidence.length ? <MiniList label="판단 근거" items={check.evidence} /> : null}
            {check.issues.length ? <MiniList label="문제" items={check.issues} /> : null}
            {check.fixes.length ? <MiniList label="수정" items={check.fixes} /> : null}
          </div>
        ))}
      </div>
      {result.revisedDraft && revisedDraftText ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">검증 반영 수정본</p>
          <h3 className="mt-2 text-xl font-black text-slate-950">{result.revisedDraft.title}</h3>
          <p className="mt-2 text-sm font-bold leading-6 text-emerald-900">{result.revisedDraft.thesisOrGoal}</p>
          <div className="mt-4 space-y-4">
            {result.revisedDraft.sections.map((section, index) => (
              <div key={`${section.heading}-${index}`}>
                <h4 className="font-black text-slate-900">{section.heading}</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-7 text-slate-700">{section.body}</p>
              </div>
            ))}
          </div>
          <button
            className={secondaryButtonClass}
            onClick={() => void navigator.clipboard.writeText(revisedDraftText)}
            type="button"
          >
            수정본 복사
          </button>
        </div>
      ) : null}
      <p className="mt-5 text-xs leading-5 text-slate-500">이 점수는 학교 성적 예측치가 아니라 명세에 정의된 내부 품질검사 점수입니다. 웹 검증이 필요한 사실은 확인 전 확정하지 않습니다.</p>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "PASS" ? "통과" : status === "PARTIAL" ? "부분 충족" : status === "FAIL" ? "수정 필요" : "웹 확인 필요";
  const style = status === "PASS" ? "bg-emerald-100 text-emerald-800" : status === "FAIL" ? "bg-rose-100 text-rose-800" : status === "PARTIAL" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${style}`}>{label}</span>;
}

function ResultCard({ title, items, ordered = false, className = "" }: { title: string; items: string[]; ordered?: boolean; className?: string }) {
  const List = ordered ? "ol" : "ul";
  return <div className={`rounded-2xl border border-white bg-white/90 p-4 ${className}`}><h3 className="font-black text-slate-900">{title}</h3><List className={`${ordered ? "list-decimal" : "list-disc"} mt-3 space-y-2 pl-5 text-sm leading-6 text-slate-600`}>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</List></div>;
}

function MiniList({ label, items }: { label: string; items: string[] }) {
  return <div className="mt-3"><p className="text-xs font-black text-slate-500">{label}</p><ul className="mt-1 list-disc space-y-1 pl-4 text-sm leading-5 text-slate-600">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">{label}</span>{children}</label>;
}

const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
const primaryButtonClass = "mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50";
