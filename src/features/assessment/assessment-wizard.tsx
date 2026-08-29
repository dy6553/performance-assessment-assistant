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
import { PdfRubricUpload } from "./pdf-rubric-upload";
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
  const maxGrade = assignment.schoolLevel === "초등학교" ? 6 : 3;
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

  function updateSchoolLevel(level: AssignmentInput["schoolLevel"]) {
    setAssignment((current) => {
      const next = {
        ...current,
        schoolLevel: level,
        grade: Math.min(current.grade, level === "초등학교" ? 6 : 3),
      };
      writeStorage(assessmentFlowStorageKey, next);
      return next;
    });
    setTopicRecommendations([]);
    setAnalysis(null);
    setDraft(null);
    setVerification(null);
    removeStorage(assessmentAnalysisStorageKey);
    removeStorage(assessmentDraftStorageKey);
    removeStorage(assessmentVerificationStorageKey);
    setError("");
  }

  function goToTopic() {
    if (!assignment.subject.trim()) {
      setError("과목을 입력해 주세요.");
      return;
    }
    if (assignment.teacherInstruction.trim().length < 2) {
      setError("교사가 제시한 과제 설명을 입력해 주세요.");
      return;
    }
    writeStorage(assessmentFlowStorageKey, assignment);
    router.push("/assignment/topic");
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
      setError("과목을 먼저 입력해 주세요.");
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
    if (assignment.topic.trim().length < 2 || assignment.teacherInstruction.trim().length < 2) {
      setError("주제와 교사 안내문을 다시 확인해 주세요.");
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

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <FlowHeader screen={screen} assignmentType={typeMeta.shortTitle} />

      {screen === "setup" ? (
        <SetupScreen
          assignment={assignment}
          error={error}
          loading={loading}
          maxGrade={maxGrade}
          onContinue={goToTopic}
          onSchoolLevelChange={updateSchoolLevel}
          onUpdate={update}
          topicLoading={topicLoading}
          typeSlug={typeMeta.slug}
        />
      ) : null}

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

function SetupScreen({
  assignment,
  error,
  loading,
  maxGrade,
  onContinue,
  onSchoolLevelChange,
  onUpdate,
  topicLoading,
  typeSlug,
}: {
  assignment: AssignmentInput;
  error: string;
  loading: string;
  maxGrade: number;
  onContinue: () => void;
  onSchoolLevelChange: (level: AssignmentInput["schoolLevel"]) => void;
  onUpdate: <K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) => void;
  topicLoading: boolean;
  typeSlug: string;
}) {
  const typeMeta = getAssignmentTypeByValue(assignment.assignmentType);

  return (
    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">과제 정보</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">{typeMeta.title} 정보 입력</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">이 페이지에서는 과제 조건만 입력합니다. 주제는 다음 페이지에서 정합니다.</p>
        </div>
        <Link className={smallSecondaryButtonClass} href="/">유형 다시 선택</Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="교육과정">
          <select
            className={inputClass}
            value={assignment.curriculum}
            onChange={(event) => onUpdate("curriculum", event.target.value as AssignmentInput["curriculum"])}
          >
            <option value="2022 개정 교육과정">2022 개정 교육과정</option>
            <option value="2015 개정 교육과정">2015 개정 교육과정</option>
          </select>
        </Field>
        <Field label="학교급">
          <select
            className={inputClass}
            value={assignment.schoolLevel}
            onChange={(event) => onSchoolLevelChange(event.target.value as AssignmentInput["schoolLevel"])}
          >
            <option>초등학교</option>
            <option>중학교</option>
            <option>고등학교</option>
          </select>
        </Field>
        <Field label="학년">
          <select className={inputClass} value={assignment.grade} onChange={(event) => onUpdate("grade", Number(event.target.value))}>
            {Array.from({ length: maxGrade }, (_, index) => index + 1).map((grade) => (
              <option key={grade} value={grade}>{grade}학년</option>
            ))}
          </select>
        </Field>
        <Field label="과목">
          <input className={inputClass} value={assignment.subject} onChange={(event) => onUpdate("subject", event.target.value)} placeholder="예: 통합사회1" />
        </Field>
      </div>

      <div className="mt-6 rounded-[1.75rem] border border-violet-100 bg-violet-50/50 p-4 sm:p-5">
        <p className="text-sm font-black text-violet-900">{typeMeta.title}에 맞는 입력 항목</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-violet-700">선택한 수행평가 유형에 따라 아래 항목이 달라집니다.</p>
        <div className="mt-4">
          <TypeSpecificFields assignment={assignment} onUpdate={onUpdate} typeSlug={typeSlug} />
        </div>
      </div>

      <div className="mt-5">
        <Field label="교사가 제시한 과제 설명">
          <textarea
            className={`${inputClass} min-h-40 resize-y`}
            value={assignment.teacherInstruction}
            onChange={(event) => onUpdate("teacherInstruction", event.target.value)}
            placeholder="수행평가 안내문, 선생님이 말한 조건, 제출 방법 등을 가능한 한 그대로 입력하세요."
          />
        </Field>
      </div>

      <div className="mt-5">
        <PdfRubricUpload disabled={Boolean(loading) || topicLoading} onExtracted={(text) => onUpdate("rubricText", text)} />
      </div>

      {assignment.rubricText ? (
        <div className="mt-4">
          <Field label="평가 기준 / 루브릭">
            <textarea className={`${inputClass} min-h-32 resize-y`} value={assignment.rubricText} onChange={(event) => onUpdate("rubricText", event.target.value)} />
          </Field>
        </div>
      ) : null}

      <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer font-black text-slate-800">성취기준 등 추가 정보</summary>
        <div className="mt-4">
          <Field label="성취기준">
            <textarea
              className={`${inputClass} min-h-28 resize-y`}
              value={assignment.achievementStandardText}
              onChange={(event) => onUpdate("achievementStandardText", event.target.value)}
              placeholder="선생님이 제시한 성취기준이 있다면 입력하세요."
            />
          </Field>
        </div>
      </details>

      <Feedback error={error} loading={loading} />

      <div className="mt-6 flex justify-end">
        <button className={primaryButtonClass} onClick={onContinue} type="button">
          주제 선택으로 다음 →
        </button>
      </div>
    </section>
  );
}

function TypeSpecificFields({
  assignment,
  onUpdate,
  typeSlug,
}: {
  assignment: AssignmentInput;
  onUpdate: <K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) => void;
  typeSlug: string;
}) {
  if (typeSlug === "report") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="보고서 유형">
          <select className={inputClass} value={assignment.formatRule} onChange={(event) => onUpdate("formatRule", event.target.value)}>
            <option value="">선택 안 함</option>
            <option value="탐구보고서">탐구보고서</option>
            <option value="조사보고서">조사보고서</option>
            <option value="논술형 보고서">논술형 보고서</option>
          </select>
        </Field>
        <Field label="단원 / 탐구 범위">
          <input className={inputClass} value={assignment.course} onChange={(event) => onUpdate("course", event.target.value)} placeholder="예: 통합사회 3단원" />
        </Field>
        <Field label="분량 조건">
          <input className={inputClass} value={assignment.lengthRule} onChange={(event) => onUpdate("lengthRule", event.target.value)} placeholder="예: A4 3쪽, 1500~2000자" />
        </Field>
        <Field label="필수 조사 내용 / 포함 요소">
          <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.requiredElements} onChange={(event) => onUpdate("requiredElements", event.target.value)} placeholder="예: 원인·현황·사례·해결 방안·출처 3개 이상" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="현재 생각 / 조사 방향">
            <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.studentIdeas} onChange={(event) => onUpdate("studentIdeas", event.target.value)} placeholder="이미 떠올린 주장이나 조사하고 싶은 방향이 있다면 적어 주세요." />
          </Field>
        </div>
      </div>
    );
  }

  if (typeSlug === "presentation") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="발표·토론 형태">
          <select className={inputClass} value={assignment.formatRule} onChange={(event) => onUpdate("formatRule", event.target.value)}>
            <option value="">선택 안 함</option>
            <option value="개인 발표">개인 발표</option>
            <option value="모둠 발표">모둠 발표</option>
            <option value="토론">토론</option>
            <option value="발표 후 질의응답">발표 후 질의응답</option>
          </select>
        </Field>
        <Field label="단원 / 발표 범위">
          <input className={inputClass} value={assignment.course} onChange={(event) => onUpdate("course", event.target.value)} placeholder="예: 한국사 개항기" />
        </Field>
        <Field label="발표 시간 / 분량">
          <input className={inputClass} value={assignment.lengthRule} onChange={(event) => onUpdate("lengthRule", event.target.value)} placeholder="예: 5분 발표, 슬라이드 8장 이내" />
        </Field>
        <Field label="필수 포함 내용">
          <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.requiredElements} onChange={(event) => onUpdate("requiredElements", event.target.value)} placeholder="예: 주장 1개, 근거 3개, 반론 예상, 시각 자료" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="내 주장 / 핵심 메시지">
            <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.studentIdeas} onChange={(event) => onUpdate("studentIdeas", event.target.value)} placeholder="발표나 토론에서 전달하고 싶은 핵심 생각이 있다면 적어 주세요." />
          </Field>
        </div>
      </div>
    );
  }

  if (typeSlug === "experiment") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="결과 제출 형태">
          <select className={inputClass} value={assignment.formatRule} onChange={(event) => onUpdate("formatRule", event.target.value)}>
            <option value="">선택 안 함</option>
            <option value="실험 보고서">실험 보고서</option>
            <option value="탐구 보고서">탐구 보고서</option>
            <option value="관찰 기록">관찰 기록</option>
            <option value="실험 발표">실험 발표</option>
          </select>
        </Field>
        <Field label="단원 / 탐구 범위">
          <input className={inputClass} value={assignment.course} onChange={(event) => onUpdate("course", event.target.value)} placeholder="예: 화학 반응과 에너지" />
        </Field>
        <Field label="실험 조건·변인·필수 요소">
          <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.requiredElements} onChange={(event) => onUpdate("requiredElements", event.target.value)} placeholder="예: 독립변인·종속변인 설정, 3회 반복 측정, 안전 수칙" />
        </Field>
        <Field label="기록 / 발표 분량">
          <input className={inputClass} value={assignment.lengthRule} onChange={(event) => onUpdate("lengthRule", event.target.value)} placeholder="예: 보고서 A4 2쪽" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="가설 / 예상 결과 / 관찰 포인트">
            <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.studentIdeas} onChange={(event) => onUpdate("studentIdeas", event.target.value)} placeholder="예상하는 결과나 확인하고 싶은 현상을 적어 주세요." />
          </Field>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="세부 과목 / 단원">
        <input className={inputClass} value={assignment.course} onChange={(event) => onUpdate("course", event.target.value)} placeholder="선택 사항" />
      </Field>
      <Field label="제출 형식">
        <input className={inputClass} value={assignment.formatRule} onChange={(event) => onUpdate("formatRule", event.target.value)} placeholder="예: 보고서 PDF, 발표 자료" />
      </Field>
      <Field label="분량 / 시간 조건">
        <input className={inputClass} value={assignment.lengthRule} onChange={(event) => onUpdate("lengthRule", event.target.value)} placeholder="예: 1500자, 5분" />
      </Field>
      <Field label="추가 요구사항">
        <textarea className={`${inputClass} min-h-28 resize-y`} value={assignment.requiredElements} onChange={(event) => onUpdate("requiredElements", event.target.value)} placeholder="과제 안내에서 반드시 포함하라고 한 내용이 있다면 적어 주세요." />
      </Field>
    </div>
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
    ["과목", assignment.subject],
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

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-black text-slate-400">교사 과제 설명</p>
        <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{assignment.teacherInstruction}</p>
      </div>

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
const smallSecondaryButtonClass = "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50";
