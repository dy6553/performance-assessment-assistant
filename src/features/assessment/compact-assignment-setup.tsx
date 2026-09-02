"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
  getAssignmentTypeBySlug,
  getAssignmentTypeByValue,
  initialAssignment,
} from "./assessment-flow";
import { PdfRubricUpload } from "./pdf-rubric-upload";
import type { AssignmentInput } from "./schemas";

const schoolGradeOptions: Array<{ schoolLevel: AssignmentInput["schoolLevel"]; grade: number; label: string }> = [
  ...Array.from({ length: 6 }, (_, index) => ({ schoolLevel: "초등학교" as const, grade: index + 1, label: `초등학교 ${index + 1}학년` })),
  ...Array.from({ length: 3 }, (_, index) => ({ schoolLevel: "중학교" as const, grade: index + 1, label: `중학교 ${index + 1}학년` })),
  ...Array.from({ length: 3 }, (_, index) => ({ schoolLevel: "고등학교" as const, grade: index + 1, label: `고등학교 ${index + 1}학년` })),
];

export function CompactAssignmentSetup({ typeSlug, keepType }: { typeSlug: string; keepType?: boolean }) {
  const router = useRouter();
  const [assignment, setAssignment] = useState<AssignmentInput>(initialAssignment);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const selectedType = getAssignmentTypeBySlug(typeSlug);
      if (!selectedType) return;

      const stored = readStorage<Partial<AssignmentInput>>(assessmentFlowStorageKey);
      const base = normalizeAssignment(stored);
      const next = keepType && base.assignmentType !== "자동 분석"
        ? base
        : { ...base, assignmentType: selectedType.value };

      writeStorage(assessmentFlowStorageKey, next);
      setAssignment(next);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [keepType, typeSlug]);

  function update<K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) {
    setAssignment((current) => {
      const next = { ...current, [key]: value };
      writeStorage(assessmentFlowStorageKey, next);
      return next;
    });
    clearDownstream();
    setError("");
  }

  function updateSchoolGrade(value: string) {
    const option = schoolGradeOptions.find((item) => `${item.schoolLevel}:${item.grade}` === value);
    if (!option) return;

    setAssignment((current) => {
      const next = { ...current, schoolLevel: option.schoolLevel, grade: option.grade };
      writeStorage(assessmentFlowStorageKey, next);
      return next;
    });
    clearDownstream();
    setError("");
  }

  function continueToTopic() {
    if (!assignment.subject.trim()) {
      setError("과목을 입력해 주세요.");
      return;
    }
    if (!assignment.course.trim()) {
      setError("세부단원을 입력해 주세요.");
      return;
    }
    if (!assignment.formatRule.trim()) {
      setError("제출 형식을 입력해 주세요.");
      return;
    }
    if (assignment.teacherInstruction.trim().length < 2 && assignment.rubricText.trim().length < 2) {
      setError("과제 안내서·평가기준표 PDF나 사진을 올리거나 추가 설명에 교사 과제 설명을 입력해 주세요.");
      return;
    }
    writeStorage(assessmentFlowStorageKey, assignment);
    router.push("/assignment/topic");
  }

  if (!hydrated) {
    return <main className="mx-auto min-h-[60dvh] max-w-4xl px-4 py-8 sm:px-6"><p className="text-sm font-black text-violet-700">과제 정보를 불러오는 중입니다.</p></main>;
  }

  const typeMeta = getAssignmentTypeByValue(assignment.assignmentType);
  const schoolGradeValue = `${assignment.schoolLevel}:${assignment.grade}`;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link className="text-sm font-black text-violet-700" href="/">← 수행평가 유형</Link>
        <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-700">{typeMeta.shortTitle}</span>
      </div>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-600">과제 정보</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">{typeMeta.title} 정보 입력</h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              <span className="font-black text-violet-700">*</span> 표시 항목은 필수입니다. 선택 항목은 필요한 경우에만 입력하세요.
            </p>
          </div>
          <Link className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600" href="/">유형 다시 선택</Link>
        </div>

        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="교육과정" required>
                <select className={inputClass} value={assignment.curriculum} onChange={(event) => update("curriculum", event.target.value as AssignmentInput["curriculum"])}>
                  <option value="2022 개정 교육과정">2022 개정 교육과정</option>
                  <option value="2015 개정 교육과정">2015 개정 교육과정</option>
                </select>
              </Field>

              <Field label="학교급 · 학년" required>
                <select className={inputClass} value={schoolGradeValue} onChange={(event) => updateSchoolGrade(event.target.value)}>
                  <optgroup label="초등학교">
                    {schoolGradeOptions.filter((item) => item.schoolLevel === "초등학교").map((item) => (
                      <option key={`${item.schoolLevel}-${item.grade}`} value={`${item.schoolLevel}:${item.grade}`}>{item.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="중학교">
                    {schoolGradeOptions.filter((item) => item.schoolLevel === "중학교").map((item) => (
                      <option key={`${item.schoolLevel}-${item.grade}`} value={`${item.schoolLevel}:${item.grade}`}>{item.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="고등학교">
                    {schoolGradeOptions.filter((item) => item.schoolLevel === "고등학교").map((item) => (
                      <option key={`${item.schoolLevel}-${item.grade}`} value={`${item.schoolLevel}:${item.grade}`}>{item.label}</option>
                    ))}
                  </optgroup>
                </select>
              </Field>
            </div>
          </div>

          <Field label="과목 및 세부단원" required>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className={inputClass} value={assignment.subject} onChange={(event) => update("subject", event.target.value)} placeholder="과목 예: 통합사회1" />
              <input className={inputClass} value={assignment.course} onChange={(event) => update("course", event.target.value)} placeholder="세부단원 예: 인간, 사회, 환경과 행복" />
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="제출 형식" required>
              <input className={inputClass} value={assignment.formatRule} onChange={(event) => update("formatRule", event.target.value)} placeholder="예: 보고서 PDF, 발표 자료" />
            </Field>
            <Field label="분량 / 시간" optional>
              <input className={inputClass} value={assignment.lengthRule} onChange={(event) => update("lengthRule", event.target.value)} placeholder="예: 1500자, A4 2쪽, 5분" />
            </Field>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-700">
            과제 문서 <span className="text-violet-700" aria-label="필수">*</span>
          </div>
          <p className="mb-3 text-xs font-semibold leading-5 text-slate-500">평가기준표나 수행평가 안내서가 있으면 PDF 또는 사진으로 올려 주세요. 파일이 없다면 아래 추가 설명에 교사 안내 내용을 입력하면 됩니다.</p>
          <PdfRubricUpload
            disabled={false}
            onExtracted={(text) => update("rubricText", text)}
            onGuideExtracted={(text) => update("teacherInstruction", text)}
          />
        </div>

        {assignment.rubricText ? (
          <details className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
            <summary className="cursor-pointer text-sm font-black text-emerald-800">판독된 평가기준 확인</summary>
            <textarea className={`${inputClass} mt-3 min-h-28 resize-y bg-white`} value={assignment.rubricText} onChange={(event) => update("rubricText", event.target.value)} />
          </details>
        ) : null}

        <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <summary className="cursor-pointer text-sm font-black text-slate-800">추가 설명 및 정보 <span className="ml-1 font-semibold text-slate-400">(선택)</span></summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="교사가 제시한 과제 설명" optional>
                <textarea
                  className={`${inputClass} min-h-28 resize-y`}
                  value={assignment.teacherInstruction}
                  onChange={(event) => update("teacherInstruction", event.target.value)}
                  placeholder="PDF나 사진에 없는 선생님 설명, 제출 방법, 주의사항 등이 있다면 입력하세요. 파일이 없다면 과제 안내 내용을 여기에 입력하세요."
                />
              </Field>
            </div>
            <Field label="추가 요구사항" optional>
              <textarea className={`${inputClass} min-h-24 resize-y`} value={assignment.requiredElements} onChange={(event) => update("requiredElements", event.target.value)} placeholder="추가로 반드시 포함하라고 한 내용이 있다면 입력하세요." />
            </Field>
            <Field label="성취기준" optional>
              <textarea className={`${inputClass} min-h-24 resize-y`} value={assignment.achievementStandardText} onChange={(event) => update("achievementStandardText", event.target.value)} placeholder="교사가 제시한 성취기준이 있다면 입력하세요." />
            </Field>
            <div className="sm:col-span-2">
              <Field label="내가 이미 생각한 내용 / 준비한 자료" optional>
                <textarea className={`${inputClass} min-h-24 resize-y`} value={assignment.studentIdeas} onChange={(event) => update("studentIdeas", event.target.value)} placeholder="이미 정한 방향이나 준비한 자료가 있다면 적어 주세요." />
              </Field>
            </div>
          </div>
        </details>

        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}

        <div className="mt-6 flex justify-end">
          <button className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-700" onClick={continueToTopic} type="button">주제 선택으로 다음 →</button>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
  required = false,
  optional = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block text-sm font-black text-slate-700">
      <span className="inline-flex items-center gap-1.5">
        {label}
        {required ? <span className="text-violet-700" aria-label="필수">*</span> : null}
        {optional ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-400">선택</span> : null}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function normalizeAssignment(stored: Partial<AssignmentInput> | null): AssignmentInput {
  if (!stored || typeof stored !== "object") return initialAssignment;
  const schoolLevel = stored.schoolLevel === "초등학교" || stored.schoolLevel === "중학교" || stored.schoolLevel === "고등학교" ? stored.schoolLevel : initialAssignment.schoolLevel;
  const curriculum = stored.curriculum === "2015 개정 교육과정" || stored.curriculum === "2022 개정 교육과정" ? stored.curriculum : initialAssignment.curriculum;
  const maxGrade = schoolLevel === "초등학교" ? 6 : 3;
  const grade = typeof stored.grade === "number" && Number.isInteger(stored.grade) ? Math.min(Math.max(stored.grade, 1), maxGrade) : initialAssignment.grade;
  return { ...initialAssignment, ...stored, curriculum, schoolLevel, grade };
}

function readStorage<T>(key: string): T | null {
  try { const raw = window.sessionStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}

function writeStorage(key: string, value: unknown) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* keep in-memory state */ }
}

function clearDownstream() {
  try {
    window.sessionStorage.removeItem(assessmentAnalysisStorageKey);
    window.sessionStorage.removeItem(assessmentDraftStorageKey);
    window.sessionStorage.removeItem(assessmentVerificationStorageKey);
  } catch { /* ignore restrictive storage modes */ }
}

const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
