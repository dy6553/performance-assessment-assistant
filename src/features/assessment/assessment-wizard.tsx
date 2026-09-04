"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import { readApiResponse } from "@/lib/http/client-response";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
  getAssignmentTypeBySlug,
  getAssignmentTypeByValue,
  getSetupPath,
  initialAssignment,
} from "./assessment-flow";
import { CareerLinkStatusBadge } from "./career-link-status-badge";
import { CompactAssignmentSetup } from "./compact-assignment-setup";
import type {
  AnalysisResult,
  AssignmentInput,
  DraftResult,
  TopicRecommendationResult,
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
type Screen = "setup" | "topic" | "review" | "workspace";

type WizardProps = {
  screen: Screen;
  typeSlug?: string;
};

const topicDependencyKeys: Array<keyof AssignmentInput> = [
  "curriculum",
  "schoolLevel",
  "grade",
  "subject",
  "course",
  "assignmentType",
  "careerLinked",
  "teacherInstruction",
  "rubricText",
  "requiredElements",
  "lengthRule",
  "formatRule",
];

export function AssessmentWizard({ screen, typeSlug }: WizardProps) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<AssignmentInput>(initialAssignment);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [verification, setVerification] = useState<VerificationWithScore | null>(null);
  const [topicRecommendations, setTopicRecommendations] = useState<TopicRecommendationResult["topics"]>([]);
  const [topicLoading, setTopicLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const typeMeta = getAssignmentTypeByValue(assignment.assignmentType);
  const draftText = useMemo(
    () => draft?.sections.map((section) => `${section.heading}\n${section.body}`).join("\n\n") ?? "",
    [draft],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = readStorage<Partial<AssignmentInput>>(assessmentFlowStorageKey);
      const selectedType = typeSlug ? getAssignmentTypeBySlug(typeSlug) : null;
      let nextAssignment = normalizeAssignment(stored);

      if (selectedType && nextAssignment.assignmentType !== selectedType.value) {
        nextAssignment = { ...initialAssignment, assignmentType: selectedType.value };
        writeStorage(assessmentFlowStorageKey, nextAssignment);
        removeStorage(assessmentAnalysisStorageKey);
        removeStorage(assessmentDraftStorageKey);
        removeStorage(assessmentVerificationStorageKey);
      }

      setAssignment(nextAssignment);
      setAnalysis(readStorage<AnalysisResult>(assessmentAnalysisStorageKey));
      setDraft(readStorage<DraftResult>(assessmentDraftStorageKey));
      setVerification(readStorage<VerificationWithScore>(assessmentVerificationStorageKey));
      setHydrated(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [typeSlug]);

  function update<K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) {
    setAssignment((current) => {
      const next = { ...current, [key]: value };
      writeStorage(assessmentFlowStorageKey, next);
      return next;
    });

    if (topicDependencyKeys.includes(key)) setTopicRecommendations([]);
    setAnalysis(null);
    setDraft(null);
    setVerification(null);
    removeStorage(assessmentAnalysisStorageKey);
    removeStorage(assessmentDraftStorageKey);
    removeStorage(assessmentVerificationStorageKey);
    setError("");
  }

  function goToReview() {
    if (assignment.topic.trim().length < 2) {
      setError("수행평가 주제를 입력하거나 추천 주제를 선택해 주세요.");
      return;
    }
    writeStorage(assessmentFlowStorageKey, assignment);
    router.push("/assignment/review");
  }

  async function recommendTopicIdeas() {
    if (!assignment.subject.trim()) {
      setError("과목 및 단원을 먼저 입력해 주세요.");
      return;
    }

    setTopicLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignment/recommend-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculum: assignment.curriculum,
          schoolLevel: assignment.schoolLevel,
          grade: assignment.grade,
          subject: assignment.subject,
          course: assignment.course,
          assignmentType: assignment.assignmentType,
          careerLinked: assignment.careerLinked,
          teacherInstruction: assignment.teacherInstruction,
          rubricText: assignment.rubricText,
        }),
      });
      const payload = await readApiResponse<{
        data?: TopicRecommendationResult;
        route?: RouteMeta;
        error?: string;
      }>(response, "주제를 추천하지 못했습니다.");

      if (!response.ok || !payload.data || !payload.route) {
        throw new Error(payload.error || "주제를 추천하지 못했습니다.");
      }
      setTopicRecommendations(payload.data.topics);
    } catch (caught) {
      setTopicRecommendations([]);
      setError(caught instanceof Error ? caught.message : "주제 추천 중 오류가 발생했습니다.");
    } finally {
      setTopicLoading(false);
    }
  }

  async function startAnalysis() {
    const hasAssignmentGuidance = assignment.teacherInstruction.trim().length >= 2 || assignment.rubricText.trim().length >= 2;
    if (assignment.topic.trim().length < 2 || !hasAssignmentGuidance) {
      setError("주제와 과제 안내 정보(PDF 또는 추가 설명)를 다시 확인해 주세요.");
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
      const payload = await readApiResponse<{
        data?: AnalysisResult;
        route?: RouteMeta;
        error?: string;
      }>(response, "분석 결과를 만들지 못했습니다.");

      if (!response.ok || !payload.data || !payload.route) {
        throw new Error(payload.error || "분석 결과를 만들지 못했습니다.");
      }

      setAnalysis(payload.data);
      writeStorage(assessmentAnalysisStorageKey, payload.data);
      removeStorage(assessmentDraftStorageKey);
      removeStorage(assessmentVerificationStorageKey);
      router.push("/assignment/workspace");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function generate() {
    if (!analysis) return;
    setLoading("작성 전략을 바탕으로 초안을 만들고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis }),
      });
      const payload = await readApiResponse<{
        data?: DraftResult;
        route?: RouteMeta;
        error?: string;
      }>(response, "초안을 만들지 못했습니다.");

      if (!response.ok || !payload.data || !payload.route) {
        throw new Error(payload.error || "초안을 만들지 못했습니다.");
      }

      setDraft(payload.data);
      setVerification(null);
      writeStorage(assessmentDraftStorageKey, payload.data);
      removeStorage(assessmentVerificationStorageKey);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 작성 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  async function verify() {
    if (!analysis || !draft) return;
    setLoading("요구조건·논리·사실과 출처·루브릭을 독립 검증하고 있습니다.");
    setError("");
    try {
      const response = await fetch("/api/assignment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, draft }),
      });
      const payload = await readApiResponse<{
        data?: VerificationWithScore;
        route?: RouteMeta;
        error?: string;
      }>(response, "초안을 검증하지 못했습니다.");

      if (!response.ok || !payload.data || !payload.route) {
        throw new Error(payload.error || "초안을 검증하지 못했습니다.");
      }

      setVerification(payload.data);
      writeStorage(assessmentVerificationStorageKey, payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "검증 중 오류가 발생했습니다.");
    } finally {
      setLoading("");
    }
  }

  if (!hydrated) {
    return (
      <main className="mx-auto min-h-[70dvh] max-w-5xl px-4 py-8 sm:px-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-black text-violet-700">수행평가 정보를 불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (screen === "setup") {
    return <CompactAssignmentSetup typeSlug={typeSlug ?? typeMeta.slug} keepType />;
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <FlowHeader screen={screen} assignmentType={typeMeta.shortTitle} />

      {screen === "topic" ? (
        <TopicScreen
          assignment={assignment}
          error={error}
          loading={loading}
          onBack={() => router.push(getSetupPath(assignment.assignmentType))}
          onContinue={goToReview}
          onRecommend={() => void recommendTopicIdeas()}
          onUpdate={update}
          recommendations={topicRecommendations}
          topicLoading={topicLoading}
        />
      ) : null}

      {screen === "review" ? (
        <ReviewScreen
          assignment={assignment}
          error={error}
          loading={loading}
          onBack={() => router.push("/assignment/topic")}
          onStart={() => void startAnalysis()}
        />
      ) : null}

      {screen === "workspace" ? (
        <WorkspaceScreen
          analysis={analysis}
          assignment={assignment}
          draft={draft}
          draftText={draftText}
          error={error}
          loading={loading}
          onGenerate={() => void generate()}
          onVerify={() => void verify()}
          verification={verification}
        />
      ) : null}
    </main>
  );
}

function TopicScreen({
  assignment,
  error,
  loading,
  onBack,
  onContinue,
  onRecommend,
  onUpdate,
  recommendations,
  topicLoading,
}: {
  assignment: AssignmentInput;
  error: string;
  loading: string;
  onBack: () => void;
  onContinue: () => void;
  onRecommend: () => void;
  onUpdate: <K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) => void;
  recommendations: TopicRecommendationResult["topics"];
  topicLoading: boolean;
}) {
  const typeMeta = getAssignmentTypeByValue(assignment.assignmentType);

  return (
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">주제 선택</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">수행평가 주제를 정하세요</h1>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">직접 입력하거나 AI 추천을 받아 선택할 수 있습니다.</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <ContextBadge>{typeMeta.title}</ContextBadge>
        <ContextBadge>{assignment.schoolLevel} {assignment.grade}학년</ContextBadge>
        <ContextBadge>{assignment.subject}</ContextBadge>
        <ContextBadge>{assignment.curriculum}</ContextBadge>
        <CareerLinkStatusBadge value={assignment.careerLinked} />
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-violet-200 bg-violet-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-violet-950">AI 주제 추천</h2>
            <p className="mt-1 text-xs font-semibold leading-5 text-violet-700">학년·과목·수행평가 유형·교사 안내·루브릭을 반영해 추천합니다.</p>
          </div>
          <button className="inline-flex min-h-11 items-center rounded-2xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50" disabled={topicLoading} onClick={onRecommend} type="button">
            {topicLoading ? "추천 중..." : recommendations.length ? "다시 추천" : "AI 주제 추천 받기"}
          </button>
        </div>

        {recommendations.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {recommendations.map((item, index) => {
              const selected = assignment.topic === item.title;
              return (
                <button
                  aria-pressed={selected}
                  className={`rounded-2xl border p-4 text-left transition ${selected ? "border-violet-500 bg-white ring-2 ring-violet-200" : "border-violet-100 bg-white/80 hover:border-violet-300"}`}
                  key={`${item.title}-${index}`}
                  onClick={() => onUpdate("topic", item.title)}
                  type="button"
                >
                  <span className="block text-sm font-black text-slate-950">{item.title}</span>
                  <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{item.rationale}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="mt-6">
        <Field label="직접 입력하거나 선택한 주제">
          <textarea
            className={`${inputClass} min-h-28 resize-y`}
            value={assignment.topic}
            onChange={(event) => onUpdate("topic", event.target.value)}
            placeholder="예: 기후위기 대응 정책의 효과를 국내외 사례로 비교하기"
          />
        </Field>
      </div>

      <Feedback error={error} loading={loading} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button className={secondaryButtonClass} onClick={onBack} type="button">← 이전</button>
        <button className={primaryButtonClass} onClick={onContinue} type="button">최종 확인으로 다음 →</button>
      </div>
    </section>
  );
}

function ReviewScreen({
  assignment,
  error,
  loading,
  onBack,
  onStart,
}: {
  assignment: AssignmentInput;
  error: string;
  loading: string;
  onBack: () => void;
  onStart: () => void;
}) {
  const typeMeta = getAssignmentTypeByValue(assignment.assignmentType);
  const rows = [
    ["수행평가 유형", typeMeta.title],
    ["교육과정", assignment.curriculum],
    ["학교·학년", `${assignment.schoolLevel} ${assignment.grade}학년`],
    ["과목 및 단원", assignment.subject],
    ["세부 범위", assignment.course || "입력하지 않음"],
    ["주제", assignment.topic],
    ["제출 형식", assignment.formatRule || "입력하지 않음"],
    ["분량·시간", assignment.lengthRule || "입력하지 않음"],
  ];

  return (
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">최종 확인</p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">입력한 내용을 확인하세요</h1>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">분석을 시작하면 다음 페이지에서 작성 전략 → 초안 → 검증 순서로 진행합니다.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={label}>
            <p className="text-xs font-black text-slate-400">{label}</p>
            <p className="mt-2 text-sm font-black leading-6 text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {assignment.teacherInstruction ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-black text-slate-400">교사 과제 설명</p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{assignment.teacherInstruction}</p>
        </div>
      ) : null}

      {assignment.requiredElements ? <SummaryBlock label="필수 포함 요소" value={assignment.requiredElements} /> : null}
      {assignment.studentIdeas ? <SummaryBlock label="내 생각 / 조사·탐구 방향" value={assignment.studentIdeas} /> : null}
      {assignment.rubricText ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-black text-emerald-800">평가 기준 / 루브릭이 함께 반영됩니다.</div>
      ) : null}

      <Feedback error={error} loading={loading} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button className={secondaryButtonClass} disabled={Boolean(loading)} onClick={onBack} type="button">← 주제 수정</button>
        <button className={primaryButtonClass} disabled={Boolean(loading)} onClick={onStart} type="button">
          {loading ? "분석 중..." : "분석 시작하고 작성 페이지로 →"}
        </button>
      </div>
    </section>
  );
}

function WorkspaceScreen({
  analysis,
  assignment,
  draft,
  draftText,
  error,
  loading,
  onGenerate,
  onVerify,
  verification,
}: {
  analysis: AnalysisResult | null;
  assignment: AssignmentInput;
  draft: DraftResult | null;
  draftText: string;
  error: string;
  loading: string;
  onGenerate: () => void;
  onVerify: () => void;
  verification: VerificationWithScore | null;
}) {
  if (!analysis) {
    return (
      <section className="mt-6 rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
        <h1 className="text-2xl font-black text-slate-950">분석 결과가 없습니다.</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">최종 확인 페이지에서 분석을 먼저 시작해 주세요.</p>
        <Link className={`${primaryButtonClass} mt-5`} href="/assignment/review">최종 확인으로 돌아가기</Link>
      </section>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="rounded-[2rem] border border-violet-200 bg-violet-50/60 p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">작성 전략</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black text-slate-950">{analysis.taskType.primary}</h1>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">분류 신뢰도 {Math.round(analysis.taskType.confidence * 100)}%</span>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{analysis.curriculum.version}</span>
          <CareerLinkStatusBadge value={assignment.careerLinked} />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{analysis.curriculum.basis}</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ResultCard title="이 수행평가에서 가장 중요한 것" items={analysis.strategy.important} />
          <ResultCard title="평가기준별 전략" items={analysis.strategy.rubricStrategies} />
          <ResultCard title="추천 구조" items={analysis.strategy.recommendedStructure} ordered />
          <ResultCard title="감점 위험" items={analysis.strategy.deductionRisks} />
        </div>

        {analysis.warnings.length ? <ResultCard className="mt-4" title="확인 필요" items={analysis.warnings} /> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link className={secondaryButtonClass} href="/assignment/review">입력 내용 다시 보기</Link>
          <button className={primaryButtonClass} disabled={Boolean(loading)} onClick={onGenerate} type="button">
            {draft ? "초안 다시 작성" : "이 전략으로 초안 작성"}
          </button>
        </div>
      </section>

      {draft ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">수행평가 초안</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950">{draft.title}</h2>
          <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-900">핵심 목표: {draft.thesisOrGoal}</p>
          <article className="mt-6 space-y-6">
            {draft.sections.map((section, index) => (
              <div key={`${section.heading}-${index}`}>
                <h3 className="text-lg font-black text-slate-900">{section.heading}</h3>
                <p className="mt-2 whitespace-pre-wrap text-[15px] font-medium leading-7 text-slate-700">{section.body}</p>
              </div>
            ))}
          </article>
          {draft.sourceNeeds.length ? <ResultCard className="mt-6" title="추가 출처 검증이 필요한 부분" items={draft.sourceNeeds} /> : null}
          {draft.uncertainties.length ? <ResultCard className="mt-4" title="확실히 검증되지 않은 내용" items={draft.uncertainties} /> : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <button className={primaryButtonClass} disabled={Boolean(loading)} onClick={onVerify} type="button">초안 독립 검증</button>
            <CopyButton className={secondaryButtonClass} label="초안 복사" text={draftText} />
          </div>
        </section>
      ) : null}

      {verification ? <VerificationPanel result={verification} /> : null}

      <Feedback error={error} loading={loading} />

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-400">현재 과제</p>
        <p className="mt-1 text-sm font-black text-slate-900">{assignment.subject} · {assignment.topic}</p>
      </section>
    </div>
  );
}

function FlowHeader({ screen, assignmentType }: { screen: Screen; assignmentType: string }) {
  const labels = ["유형", "정보", "주제", "확인", "작성"];
  const activeIndex = { setup: 1, topic: 2, review: 3, workspace: 4 }[screen];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm font-black text-violet-700" href="/">← 수행평가 유형</Link>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">{assignmentType}</span>
      </div>
      <div className="mt-5 grid grid-cols-5 gap-1.5" aria-label="진행 단계">
        {labels.map((label, index) => (
          <div
            className={`rounded-xl px-1 py-2 text-center text-[11px] font-black sm:text-xs ${index <= activeIndex ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-400"}`}
            key={label}
          >
            {index + 1}. {label}
          </div>
        ))}
      </div>
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
      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">검증 보고서</p>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-5xl font-black tracking-[-0.06em] text-slate-950">{result.readinessScore}</span>
        <span className="pb-1 text-sm font-bold text-slate-500">/ 100 제출 준비도</span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{result.summary}</p>
      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {checks.map(([label, check]) => (
          <div className="rounded-2xl border border-white bg-white/90 p-4" key={label}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-black text-slate-900">{label}</h3>
              <StatusBadge status={check.status} />
            </div>
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
                <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-7 text-slate-700">{section.body}</p>
              </div>
            ))}
          </div>
          <CopyButton className={secondaryButtonClass} label="수정본 복사" text={revisedDraftText} />
        </div>
      ) : null}
    </section>
  );
}

function Feedback({ error, loading }: { error: string; loading: string }) {
  return (
    <>
      {error ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
      {loading ? <p className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-700">{loading}</p> : null}
    </>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function ContextBadge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{children}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const label = status === "PASS" ? "통과" : status === "PARTIAL" ? "부분 충족" : status === "FAIL" ? "수정 필요" : "웹 확인 필요";
  const style = status === "PASS" ? "bg-emerald-100 text-emerald-800" : status === "FAIL" ? "bg-rose-100 text-rose-800" : status === "PARTIAL" ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-black ${style}`}>{label}</span>;
}

function ResultCard({
  title,
  items,
  ordered = false,
  className = "",
}: {
  title: string;
  items: string[];
  ordered?: boolean;
  className?: string;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <div className={`rounded-2xl border border-white bg-white/90 p-4 ${className}`}>
      <h3 className="font-black text-slate-900">{title}</h3>
      <List className={`${ordered ? "list-decimal" : "list-disc"} mt-3 space-y-2 pl-5 text-sm font-medium leading-6 text-slate-600`}>
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </List>
    </div>
  );
}

function MiniList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm font-medium leading-5 text-slate-600">
        {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function normalizeAssignment(stored: Partial<AssignmentInput> | null): AssignmentInput {
  if (!stored || typeof stored !== "object") return initialAssignment;

  const schoolLevel = stored.schoolLevel === "초등학교" || stored.schoolLevel === "중학교" || stored.schoolLevel === "고등학교"
    ? stored.schoolLevel
    : initialAssignment.schoolLevel;
  const curriculum = stored.curriculum === "2015 개정 교육과정" || stored.curriculum === "2022 개정 교육과정"
    ? stored.curriculum
    : initialAssignment.curriculum;
  const maxGrade = schoolLevel === "초등학교" ? 6 : 3;
  const grade = typeof stored.grade === "number" && Number.isInteger(stored.grade)
    ? Math.min(Math.max(stored.grade, 1), maxGrade)
    : initialAssignment.grade;

  return {
    ...initialAssignment,
    ...stored,
    curriculum,
    schoolLevel,
    grade,
    subject: typeof stored.subject === "string" ? stored.subject : initialAssignment.subject,
    course: typeof stored.course === "string" ? stored.course : "",
    assignmentType: typeof stored.assignmentType === "string" ? stored.assignmentType : initialAssignment.assignmentType,
    topic: typeof stored.topic === "string" ? stored.topic : "",
    teacherInstruction: typeof stored.teacherInstruction === "string" ? stored.teacherInstruction : "",
    rubricText: typeof stored.rubricText === "string" ? stored.rubricText : "",
    achievementStandardText: typeof stored.achievementStandardText === "string" ? stored.achievementStandardText : "",
    requiredElements: typeof stored.requiredElements === "string" ? stored.requiredElements : "",
    lengthRule: typeof stored.lengthRule === "string" ? stored.lengthRule : "",
    formatRule: typeof stored.formatRule === "string" ? stored.formatRule : "",
    studentIdeas: typeof stored.studentIdeas === "string" ? stored.studentIdeas : "",
  };
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Session storage can be unavailable in restrictive browser modes. The current page state still works.
  }
}

function removeStorage(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures and keep the in-memory flow usable.
  }
}

const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
const primaryButtonClass = "inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
