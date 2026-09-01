"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  assessmentFlowStorageKey,
  assignmentTypeOptions,
  getSetupPath,
  initialAssignment,
} from "./assessment-flow";
import type { AssignmentInput } from "./schemas";

type TypeRecommendation = {
  primaryType: string;
  secondaryType: string | null;
  confidence: number;
  reasons: string[];
};

const selectableTypes = assignmentTypeOptions.filter((item) => item.slug !== "auto");

export function AssignmentTypeSelector() {
  const router = useRouter();
  const [assignment, setAssignment] = useState<AssignmentInput>(initialAssignment);
  const [recommendation, setRecommendation] = useState<TypeRecommendation | null>(null);
  const [primaryType, setPrimaryType] = useState("");
  const [secondaryType, setSecondaryType] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const maxGrade = assignment.schoolLevel === "초등학교" ? 6 : 3;

  function update<K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) {
    setAssignment((current) => ({ ...current, [key]: value }));
    setRecommendation(null);
    setError("");
  }

  function saveAndGo(primary: string, secondary = "") {
    const assignmentType = secondary && secondary !== primary ? `${primary} + ${secondary}` : primary;
    const next = { ...assignment, assignmentType };
    localStorage.setItem(assessmentFlowStorageKey, JSON.stringify(next));
    router.push(getSetupPath(primary));
  }

  async function recommend() {
    if (!assignment.subject.trim() || assignment.teacherInstruction.trim().length < 2) {
      setError("과목과 교사 안내문을 먼저 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignment/recommend-type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          curriculum: assignment.curriculum,
          schoolLevel: assignment.schoolLevel,
          grade: assignment.grade,
          subject: assignment.subject,
          course: assignment.course,
          teacherInstruction: assignment.teacherInstruction,
          rubricText: assignment.rubricText,
          achievementStandardText: assignment.achievementStandardText,
        }),
      });
      const payload = (await response.json()) as { data?: TypeRecommendation; error?: string };
      if (!response.ok || !payload.data) throw new Error(payload.error || "유형을 추천하지 못했습니다.");

      setRecommendation(payload.data);
      setPrimaryType(payload.data.primaryType);
      setSecondaryType(payload.data.secondaryType || "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "유형 추천 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">수행평가 유형 선택</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">직접 선택하거나 AI 추천을 받으세요</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          AI는 유형을 추천만 하고 자동 확정하지 않습니다. 추천 결과를 확인한 뒤 주 유형과 보조 유형을 직접 바꿀 수 있습니다.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {selectableTypes.map((item) => (
            <button
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.99]"
              key={item.value}
              onClick={() => saveAndGo(item.value)}
              type="button"
            >
              <span className="text-xs font-black text-violet-600">직접 선택</span>
              <strong className="mt-1 block text-base font-black text-slate-950">{item.title}</strong>
              <span className="mt-1 block text-sm font-semibold leading-5 text-slate-500">{item.description}</span>
            </button>
          ))}
        </div>

        <div className="my-7 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-black text-slate-400">유형이 헷갈리면 AI 추천</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <section className="rounded-[1.75rem] border border-violet-100 bg-violet-50/50 p-4 sm:p-5">
          <h2 className="text-lg font-black text-violet-950">공통 정보로 유형 추천</h2>
          <p className="mt-1 text-xs font-semibold leading-5 text-violet-700">
            이 단계에서는 6개 유형별 작성 프롬프트를 불러오지 않고, 교사 안내문과 평가기준만으로 유형을 분류합니다.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="교육과정">
              <select className={inputClass} value={assignment.curriculum} onChange={(event) => update("curriculum", event.target.value as AssignmentInput["curriculum"])}>
                <option value="2022 개정 교육과정">2022 개정 교육과정</option>
                <option value="2015 개정 교육과정">2015 개정 교육과정</option>
              </select>
            </Field>
            <Field label="학교급">
              <select className={inputClass} value={assignment.schoolLevel} onChange={(event) => update("schoolLevel", event.target.value as AssignmentInput["schoolLevel"])}>
                <option>초등학교</option><option>중학교</option><option>고등학교</option>
              </select>
            </Field>
            <Field label="학년">
              <select className={inputClass} value={assignment.grade} onChange={(event) => update("grade", Number(event.target.value))}>
                {Array.from({ length: maxGrade }, (_, index) => index + 1).map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}
              </select>
            </Field>
            <Field label="과목">
              <input className={inputClass} value={assignment.subject} onChange={(event) => update("subject", event.target.value)} placeholder="예: 통합사회" />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="단원 / 범위">
              <input className={inputClass} value={assignment.course} onChange={(event) => update("course", event.target.value)} placeholder="선택 사항" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="교사 안내문">
              <textarea className={`${inputClass} min-h-32 resize-y`} value={assignment.teacherInstruction} onChange={(event) => update("teacherInstruction", event.target.value)} placeholder="교사가 제시한 수행평가 안내를 가능한 한 그대로 입력하세요." />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="평가기준 / 루브릭">
              <textarea className={`${inputClass} min-h-24 resize-y`} value={assignment.rubricText} onChange={(event) => update("rubricText", event.target.value)} placeholder="있다면 입력하세요." />
            </Field>
            <Field label="성취기준">
              <textarea className={`${inputClass} min-h-24 resize-y`} value={assignment.achievementStandardText} onChange={(event) => update("achievementStandardText", event.target.value)} placeholder="교사가 제시한 경우 입력하세요." />
            </Field>
          </div>

          <button className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white transition hover:bg-violet-700 disabled:opacity-50" disabled={loading} onClick={() => void recommend()} type="button">
            {loading ? "유형 분석 중..." : "AI 유형 추천 받기"}
          </button>
        </section>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}

        {recommendation ? (
          <section className="mt-5 rounded-[1.75rem] border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-700">AI 추천 · 최종 선택은 사용자</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-black text-slate-950">추천 신뢰도 {Math.round(recommendation.confidence * 100)}%</h2>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="주 유형">
                <select className={inputClass} value={primaryType} onChange={(event) => { setPrimaryType(event.target.value); if (secondaryType === event.target.value) setSecondaryType(""); }}>
                  {selectableTypes.map((item) => <option key={item.value} value={item.value}>{item.title}</option>)}
                </select>
              </Field>
              <Field label="보조 유형 · 복합 수행평가만">
                <select className={inputClass} value={secondaryType} onChange={(event) => setSecondaryType(event.target.value)}>
                  <option value="">없음</option>
                  {selectableTypes.filter((item) => item.value !== primaryType).map((item) => <option key={item.value} value={item.value}>{item.title}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4 rounded-xl bg-white/80 p-3">
              <p className="text-sm font-black text-slate-800">추천 근거</p>
              <ul className="mt-2 space-y-1 text-sm font-semibold leading-5 text-slate-600">
                {recommendation.reasons.map((reason, index) => <li key={`${index}-${reason}`}>• {reason}</li>)}
              </ul>
            </div>

            <button className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700" onClick={() => saveAndGo(primaryType, secondaryType)} type="button">
              이 유형으로 확정하고 계속 →
            </button>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-black text-slate-700">{label}<div className="mt-1">{children}</div></label>;
}

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100";
