"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
} from "@/features/assessment/assessment-flow";
import type { AssignmentInput, DraftResult, VerificationResult } from "@/features/assessment/schemas";
import {
  downloadDocxDocument,
  downloadHwpxDocument,
  downloadPdfDocument,
  downloadTextDocument,
} from "@/lib/export/document-files";

const finalSignatureKey = "assessment-final-initialized-v1";
type VerificationWithScore = VerificationResult & { readinessScore?: number };

export default function FinalDocumentPage() {
  const [assignment, setAssignment] = useState<AssignmentInput | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [exporting, setExporting] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedAssignment = readSession<AssignmentInput>(assessmentFlowStorageKey);
      const storedDraft = readSession<DraftResult>(assessmentDraftStorageKey);
      const verification = readSession<VerificationWithScore>(assessmentVerificationStorageKey);
      setAssignment(storedAssignment);

      if (!storedDraft) {
        setDraft(null);
        return;
      }

      const signature = assignmentSignature(storedAssignment);
      const initialized = readSession<string>(finalSignatureKey);
      if (verification?.revisedDraft && signature && initialized !== signature) {
        setDraft(verification.revisedDraft);
        writeSession(assessmentDraftStorageKey, verification.revisedDraft);
        writeSession(finalSignatureKey, signature);
      } else {
        setDraft(storedDraft);
        if (signature && !initialized) writeSession(finalSignatureKey, signature);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function persist(next: DraftResult) {
    setDraft(next);
    writeSession(assessmentDraftStorageKey, next);
    setError("");
  }

  function updateSection(index: number, field: "heading" | "body", value: string) {
    if (!draft) return;
    const sections = draft.sections.map((section, sectionIndex) =>
      sectionIndex === index ? { ...section, [field]: value } : section,
    );
    persist({ ...draft, sections });
  }

  function addSection() {
    if (!draft || draft.sections.length >= 20) return;
    persist({
      ...draft,
      sections: [...draft.sections, { heading: "새 소제목", body: "내용을 입력하세요." }],
    });
  }

  function removeSection(index: number) {
    if (!draft || draft.sections.length <= 1) return;
    persist({ ...draft, sections: draft.sections.filter((_, sectionIndex) => sectionIndex !== index) });
  }

  function moveSection(index: number, direction: -1 | 1) {
    if (!draft) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.sections.length) return;
    const sections = [...draft.sections];
    [sections[index], sections[nextIndex]] = [sections[nextIndex], sections[index]];
    persist({ ...draft, sections });
  }

  async function exportFile(format: "docx" | "hwpx" | "pdf" | "txt") {
    if (!draft || exporting) return;
    if (!draft.title.trim() || !draft.thesisOrGoal.trim() || draft.sections.some((section) => !section.heading.trim() || !section.body.trim())) {
      setError("제목, 핵심 내용, 각 문단의 소제목과 본문을 채운 뒤 파일을 생성해 주세요.");
      return;
    }

    setExporting(format);
    setError("");
    try {
      if (format === "docx") downloadDocxDocument(draft);
      else if (format === "hwpx") downloadHwpxDocument(draft);
      else if (format === "pdf") await downloadPdfDocument(draft);
      else downloadTextDocument(draft);
    } catch {
      setError("파일을 생성하지 못했습니다. 다른 형식으로 다시 시도해 주세요.");
    } finally {
      setExporting("");
    }
  }

  if (!draft) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6">
        <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-2xl font-black text-slate-950">완성본으로 사용할 초고가 없습니다.</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">초고를 작성하고 검증한 뒤 완성본 단계로 진행해 주세요.</p>
          <Link className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 text-sm font-black text-white" href="/assignment/workspace">작성 화면으로 돌아가기</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-36 pt-5 sm:px-6 sm:pt-7">
      <header className="rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">완성본 단계</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">최종 내용을 직접 수정하세요</h1>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">문장·문단·제목·내용 순서를 직접 바꿀 수 있습니다. 아래의 AI 재실행 또는 Chat 모드도 계속 사용할 수 있습니다.</p>
        {assignment ? <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-black text-slate-600">{assignment.subject} · {assignment.topic}</p> : null}
      </header>

      <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <label className="block">
          <span className="text-xs font-black text-slate-500">제목</span>
          <input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-2xl font-black text-slate-950 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" maxLength={200} onChange={(event) => persist({ ...draft, title: event.target.value })} value={draft.title} />
        </label>

        <label className="mt-5 block">
          <span className="text-xs font-black text-slate-500">핵심 주장 / 목표</span>
          <textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-emerald-50/50 px-4 py-3 text-sm font-bold leading-6 text-slate-800 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" maxLength={1000} onChange={(event) => persist({ ...draft, thesisOrGoal: event.target.value })} value={draft.thesisOrGoal} />
        </label>

        <div className="mt-7 space-y-5">
          {draft.sections.map((section, index) => (
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5" key={index}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-400">문단 {index + 1}</span>
                <div className="flex gap-1.5">
                  <button className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600 disabled:opacity-30" disabled={index === 0} onClick={() => moveSection(index, -1)} type="button">위로</button>
                  <button className="min-h-9 rounded-lg bg-slate-100 px-3 text-xs font-black text-slate-600 disabled:opacity-30" disabled={index === draft.sections.length - 1} onClick={() => moveSection(index, 1)} type="button">아래로</button>
                  <button className="min-h-9 rounded-lg bg-rose-50 px-3 text-xs font-black text-rose-700 disabled:opacity-30" disabled={draft.sections.length <= 1} onClick={() => removeSection(index)} type="button">삭제</button>
                </div>
              </div>
              <input className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg font-black text-slate-950 outline-none focus:border-violet-400" maxLength={160} onChange={(event) => updateSection(index, "heading", event.target.value)} value={section.heading} />
              <textarea className="mt-3 min-h-44 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] font-medium leading-7 text-slate-700 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" maxLength={8000} onChange={(event) => updateSection(index, "body", event.target.value)} value={section.body} />
            </section>
          ))}
        </div>

        <button className="mt-4 min-h-11 w-full rounded-xl border border-dashed border-violet-300 bg-violet-50 text-sm font-black text-violet-700 disabled:opacity-50" disabled={draft.sections.length >= 20} onClick={addSection} type="button">+ 문단 추가</button>
      </section>

      <section className="mt-5 rounded-[2rem] border border-slate-200 bg-slate-950 p-5 text-white sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">최종 파일 생성</p>
        <h2 className="mt-2 text-2xl font-black">내용을 완성한 뒤 제출 형식을 선택하세요</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">파일 형식은 마지막에만 선택합니다. 현재 편집 내용이 그대로 파일에 반영됩니다.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ExportButton busy={exporting === "docx"} label="Word (.docx)" onClick={() => void exportFile("docx")} />
          <ExportButton busy={exporting === "hwpx"} label="한글 (.hwpx)" onClick={() => void exportFile("hwpx")} />
          <ExportButton busy={exporting === "pdf"} label="PDF (.pdf)" onClick={() => void exportFile("pdf")} />
          <ExportButton busy={exporting === "txt"} label="텍스트 (.txt)" onClick={() => void exportFile("txt")} />
        </div>
        {error ? <p className="mt-4 rounded-xl border border-rose-400/40 bg-rose-950/40 p-3 text-sm font-bold text-rose-100">{error}</p> : null}
      </section>

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700" href="/assignment/verification">← 검증 결과</Link>
        <Link className="inline-flex min-h-11 items-center rounded-xl bg-violet-700 px-4 text-sm font-black text-white" href="/">완료하고 홈으로</Link>
      </div>
    </main>
  );
}

function ExportButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button className="min-h-12 rounded-xl bg-white px-3 text-sm font-black text-slate-950 transition hover:bg-violet-50 disabled:opacity-50" disabled={busy} onClick={onClick} type="button">{busy ? "생성 중..." : label}</button>;
}

function assignmentSignature(assignment: AssignmentInput | null) {
  if (!assignment) return "";
  return [assignment.curriculum, assignment.schoolLevel, assignment.grade, assignment.subject, assignment.assignmentType, assignment.topic].join("|");
}

function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep editor state in memory when storage is unavailable.
  }
}
