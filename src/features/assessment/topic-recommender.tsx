"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
  assignmentTypeOptions,
  getSetupPath,
  initialAssignment,
  type AssignmentTypeValue,
} from "@/features/assessment/assessment-flow";
import type {
  AssignmentInput,
  TopicRecommendationRequest,
  TopicRecommendationResult,
} from "@/features/assessment/schemas";
import { PdfRubricUpload } from "@/features/assessment/pdf-rubric-upload";
import { readAssignmentDefaultPreferences } from "@/lib/client-preferences";
import { readApiResponse } from "@/lib/http/client-response";

type TopicForm = Omit<TopicRecommendationRequest, "avoidTopics">;

const initialForm: TopicForm = {
  curriculum: initialAssignment.curriculum,
  schoolLevel: initialAssignment.schoolLevel,
  grade: initialAssignment.grade,
  subject: initialAssignment.subject,
  course: "",
  assignmentType: initialAssignment.assignmentType,
  teacherInstruction: "",
  rubricText: "",
  achievementStandardText: "",
  requiredElements: "",
  lengthRule: "",
  formatRule: "",
  studentIdeas: "",
  interestField: "",
  desiredMajor: "",
  desiredCareer: "",
  additionalConditions: "",
};

export function TopicRecommender() {
  const router = useRouter();
  const [form, setForm] = useState<TopicForm>(initialForm);
  const [topics, setTopics] = useState<TopicRecommendationResult["topics"]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const defaults = readAssignmentDefaultPreferences();
      setForm((current) => ({
        ...current,
        curriculum: defaults.curriculum,
        schoolLevel: defaults.schoolLevel,
        grade: defaults.grade,
        subject: defaults.subject,
        assignmentType: defaults.assignmentType,
      }));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const maxGrade = form.schoolLevel === "초등학교" ? 6 : 3;

  function update<K extends keyof TopicForm>(key: K, value: TopicForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setTopics([]);
    setError("");
  }

  function updateSchoolLevel(schoolLevel: AssignmentInput["schoolLevel"]) {
    setForm((current) => ({
      ...current,
      schoolLevel,
      grade: Math.min(current.grade, schoolLevel === "초등학교" ? 6 : 3),
    }));
    setTopics([]);
    setError("");
  }

  async function recommend(avoidTopics: string[] = []) {
    if (!form.subject.trim()) {
      setError("과목을 입력해 주세요.");
      return;
    }

    const isRegeneration = avoidTopics.length > 0;
    setLoading(true);
    setRegenerating(isRegeneration);
    setError("");

    try {
      const response = await fetch("/api/assignment/recommend-topic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          avoidTopics,
        }),
      });

      const result = await readApiResponse<TopicRecommendationResult & { error?: string }>(
        response,
        "주제를 추천하지 못했습니다.",
      );
      setTopics(result.topics);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "주제를 추천하지 못했습니다.");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  }

  function startWithTopic(topic: string) {
    const assignment: AssignmentInput = {
      ...initialAssignment,
      curriculum: form.curriculum,
      schoolLevel: form.schoolLevel,
      grade: form.grade,
      subject: form.subject,
      course: form.course,
      assignmentType: form.assignmentType,
      teacherInstruction: form.teacherInstruction,
      rubricText: form.rubricText,
      studentIdeas: [
        form.interestField ? `관심 분야: ${form.interestField}` : "",
        form.desiredMajor ? `희망 학과: ${form.desiredMajor}` : "",
        form.desiredCareer ? `희망 직업: ${form.desiredCareer}` : "",
        form.additionalConditions ? `주제 추천 조건: ${form.additionalConditions}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      topic,
    };

    try {
      sessionStorage.setItem(assessmentFlowStorageKey, JSON.stringify(assignment));
      sessionStorage.removeItem(assessmentAnalysisStorageKey);
      sessionStorage.removeItem(assessmentDraftStorageKey);
      sessionStorage.removeItem(assessmentVerificationStorageKey);
    } catch {
      // 제한적인 브라우저 모드에서는 다음 화면의 기본값으로 계속 진행합니다.
    }

    router.push(getSetupPath(form.assignmentType));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 via-fuchsia-50/70 to-sky-50 p-5 shadow-sm sm:p-7">
        <span className="inline-flex rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700">AI 주제 추천</span>
        <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-slate-950">나에게 맞는 수행평가 주제를 찾아보세요.</h2>
        <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          교육과정과 과목뿐 아니라 관심 분야, 희망 학과·직업, 원하는 조건까지 반영해 4~6개의 주제를 제안합니다.
        </p>
      </section>

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white/90 shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-black text-slate-950">추천 조건</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">과목은 필수이며, 관심 분야와 진로를 적을수록 개인화된 주제를 추천합니다.</p>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="교육과정">
            <select className={inputClass} value={form.curriculum} onChange={(event) => update("curriculum", event.target.value as TopicForm["curriculum"])}>
              <option>2022 개정 교육과정</option>
              <option>2015 개정 교육과정</option>
            </select>
          </Field>

          <Field label="학교급">
            <select className={inputClass} value={form.schoolLevel} onChange={(event) => updateSchoolLevel(event.target.value as TopicForm["schoolLevel"])}>
              <option>초등학교</option>
              <option>중학교</option>
              <option>고등학교</option>
            </select>
          </Field>

          <Field label="학년">
            <select className={inputClass} value={form.grade} onChange={(event) => update("grade", Number(event.target.value))}>
              {Array.from({ length: maxGrade }, (_, index) => index + 1).map((grade) => (
                <option key={grade} value={grade}>{grade}학년</option>
              ))}
            </select>
          </Field>

          <Field label="수행평가 유형">
            <select className={inputClass} value={form.assignmentType} onChange={(event) => update("assignmentType", event.target.value as AssignmentTypeValue)}>
              {assignmentTypeOptions.map((item) => (
                <option key={item.value} value={item.value}>{item.title}</option>
              ))}
            </select>
          </Field>

          <Field label="과목">
            <input
              className={inputClass}
              maxLength={80}
              placeholder="예: 통합사회, 생명과학, 국어"
              value={form.subject}
              onChange={(event) => update("subject", event.target.value)}
            />
          </Field>

          <Field label="세부 과목·단원 (선택)">
            <input
              className={inputClass}
              maxLength={120}
              placeholder="예: 통합사회 4단원 인권"
              value={form.course}
              onChange={(event) => update("course", event.target.value)}
            />
          </Field>
        </div>

        <details className="group border-t border-slate-100 bg-violet-50/40">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
            <span>
              <span className="block font-black text-slate-950">내 관심 분야와 진로 <span className="font-semibold text-slate-400">(선택)</span></span>
              <span className="mt-1 block text-sm font-medium leading-6 text-slate-500">필요할 때만 펼쳐 입력하세요.</span>
            </span>
            <span className="text-xs font-black text-violet-600 group-open:hidden">펼치기 ＋</span>
            <span className="hidden text-xs font-black text-violet-600 group-open:inline">접기 －</span>
          </summary>
          <div className="grid gap-4 border-t border-violet-100 px-5 pb-5 pt-4 sm:grid-cols-2">
            <Field label="관심 분야 (선택)">
              <input className={inputClass} maxLength={500} placeholder="예: 인공지능, 환경, 심리, 스포츠, 디자인" value={form.interestField} onChange={(event) => update("interestField", event.target.value)} />
            </Field>
            <Field label="가고 싶은 학과 (선택)">
              <input className={inputClass} maxLength={300} placeholder="예: 컴퓨터공학과, 간호학과, 경제학과" value={form.desiredMajor} onChange={(event) => update("desiredMajor", event.target.value)} />
            </Field>
            <Field label="희망 직업 (선택)">
              <input className={inputClass} maxLength={300} placeholder="예: 소프트웨어 개발자, 의사, 교사, 연구원" value={form.desiredCareer} onChange={(event) => update("desiredCareer", event.target.value)} />
            </Field>
          </div>
        </details>

        <div className="border-t border-slate-100 p-5">
          <Field label="요청사항 (선택)">
            <textarea
              className={`${inputClass} min-h-28 resize-y py-3`}
              maxLength={2000}
              placeholder="예: 반드시 포함할 내용, 피하고 싶은 주제, 자료를 구하기 쉬운 주제, 선생님이 강조한 조건"
              value={form.additionalConditions}
              onChange={(event) => update("additionalConditions", event.target.value)}
            />
          </Field>
        </div>

        <div className="border-t border-slate-100 p-5">
          <h3 className="font-black text-slate-950">평가기준표·수행평가 안내표 업로드 <span className="font-semibold text-slate-400">(선택)</span></h3>
          <p className="mb-3 mt-1 text-sm font-medium leading-6 text-slate-500">PDF, JPG, PNG 또는 WebP 파일을 올리면 백엔드에서 변환하고 내용을 판독합니다.</p>
          <PdfRubricUpload
            disabled={loading}
            onExtracted={(text) => update("rubricText", text)}
            onGuideExtracted={(text) => update("teacherInstruction", text)}
          />
        </div>

        <div className="grid gap-4 border-t border-slate-100 p-5 lg:grid-cols-2">
          <Field label="교사 안내·과제 설명 (선택)">
            <textarea
              className={`${inputClass} min-h-32 resize-y py-3`}
              maxLength={20000}
              placeholder="선생님이 안내한 주제 범위, 꼭 들어가야 할 내용 등을 붙여 넣으세요."
              value={form.teacherInstruction}
              onChange={(event) => update("teacherInstruction", event.target.value)}
            />
          </Field>

          <Field label="평가 기준·루브릭 (선택)">
            <textarea
              className={`${inputClass} min-h-32 resize-y py-3`}
              maxLength={20000}
              placeholder="평가표의 주요 기준을 입력하면 기준에 맞는 주제를 고릅니다."
              value={form.rubricText}
              onChange={(event) => update("rubricText", event.target.value)}
            />
          </Field>
        </div>

        <div className="border-t border-slate-100 p-5">
          <button
            className="min-h-13 w-full rounded-2xl bg-violet-600 px-5 py-3.5 font-black text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            disabled={loading}
            onClick={() => void recommend()}
            type="button"
          >
            {loading && !regenerating ? "AI가 주제를 찾는 중..." : "AI로 주제 추천하기"}
          </button>
          {error ? <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
        </div>
      </section>

      {topics.length ? (
        <section aria-live="polite">
          <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">추천 결과</p>
              <h2 className="mt-1 text-xl font-black text-slate-950">마음에 드는 주제를 선택하세요.</h2>
            </div>
            <button
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              onClick={() => void recommend(topics.map((topic) => topic.title))}
              type="button"
            >
              {regenerating ? "새 주제를 다시 찾는 중..." : "마음에 안 들어요 · 새로 추천"}
            </button>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {topics.map((topic, index) => (
              <article className="rounded-[1.65rem] border border-slate-200 bg-white/90 p-5 shadow-sm" key={`${topic.title}-${index}`}>
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-black text-violet-700">{index + 1}</span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black leading-7 text-slate-950">{topic.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{topic.rationale}</p>
                  </div>
                </div>
                <button
                  className="mt-4 min-h-11 w-full rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-700 transition hover:bg-violet-100 active:scale-[0.99]"
                  onClick={() => startWithTopic(topic.title)}
                  type="button"
                >
                  이 주제로 수행평가 시작
                </button>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400";
