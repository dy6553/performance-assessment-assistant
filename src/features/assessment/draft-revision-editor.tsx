"use client";

import { useEffect, useState } from "react";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
} from "./assessment-flow";
import type { AnalysisResult, AssignmentInput, DraftResult } from "./schemas";
import { readApiResponse } from "@/lib/http/client-response";

export function DraftRevisionEditor() {
  const [assignment, setAssignment] = useState<AssignmentInput | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [instruction, setInstruction] = useState("");
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

  if (!draft) return null;

  function updateDraft(next: DraftResult) {
    setDraft(next);
    setError("");
  }

  function saveAndApply() {
    if (!draft) return;
    writeStorage(assessmentDraftStorageKey, draft);
    removeStorage(assessmentVerificationStorageKey);
    window.location.reload();
  }

  async function reviseWithAi() {
    if (!assignment || !analysis || !draft) {
      setError("수행평가 정보나 분석 결과를 불러오지 못했습니다.");
      return;
    }
    if (instruction.trim().length < 2) {
      setError("AI에게 어떻게 고칠지 원하는 조건을 적어 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/assignment/revise-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment, analysis, draft, instruction }),
      });
      const payload = await readApiResponse<{
        data?: DraftResult;
        error?: string;
      }>(response, "초안을 수정하지 못했습니다.");

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "초안을 수정하지 못했습니다.");
      }

      writeStorage(assessmentDraftStorageKey, payload.data);
      removeStorage(assessmentVerificationStorageKey);
      setDraft(payload.data);
      setInstruction("");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초안 수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-5xl px-4 pb-8 sm:px-6">
      <div className="rounded-[2rem] border border-violet-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">초안 편집</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950">직접 고치거나 AI에게 다시 수정시킬 수 있어요</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          제목·핵심 목표·각 문단을 직접 수정할 수 있고, 아래에 원하는 조건을 적어 AI가 현재 초안을 기준으로 다시 다듬게 할 수 있습니다.
        </p>

        <div className="mt-6 space-y-5">
          <Field label="제목">
            <input
              className={inputClass}
              value={draft.title}
              onChange={(event) => updateDraft({ ...draft, title: event.target.value })}
            />
          </Field>

          <Field label="핵심 목표 / 주장">
            <textarea
              className={`${inputClass} min-h-24 resize-y`}
              value={draft.thesisOrGoal}
              onChange={(event) => updateDraft({ ...draft, thesisOrGoal: event.target.value })}
            />
          </Field>

          <div className="space-y-4">
            {draft.sections.map((section, index) => (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={index}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black text-slate-500">문단 {index + 1}</p>
                  {draft.sections.length > 1 ? (
                    <button
                      className="text-xs font-black text-rose-600"
                      onClick={() => updateDraft({ ...draft, sections: draft.sections.filter((_, itemIndex) => itemIndex !== index) })}
                      type="button"
                    >
                      문단 삭제
                    </button>
                  ) : null}
                </div>
                <input
                  className={`${inputClass} mt-3`}
                  value={section.heading}
                  onChange={(event) => {
                    const sections = draft.sections.map((item, itemIndex) => itemIndex === index ? { ...item, heading: event.target.value } : item);
                    updateDraft({ ...draft, sections });
                  }}
                  placeholder="소제목"
                />
                <textarea
                  className={`${inputClass} mt-3 min-h-40 resize-y`}
                  value={section.body}
                  onChange={(event) => {
                    const sections = draft.sections.map((item, itemIndex) => itemIndex === index ? { ...item, body: event.target.value } : item);
                    updateDraft({ ...draft, sections });
                  }}
                  placeholder="본문"
                />
              </div>
            ))}
          </div>

          <button
            className={secondaryButtonClass}
            onClick={() => updateDraft({ ...draft, sections: [...draft.sections, { heading: "새 소제목", body: "" }] })}
            type="button"
          >
            + 문단 추가
          </button>

          <div className="rounded-[1.75rem] border border-violet-200 bg-violet-50 p-5">
            <h3 className="font-black text-violet-950">AI에게 원하는 수정 조건</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-violet-700">
              예: 더 자연스럽게, 1500자 정도로 줄여줘, 내 의견을 더 많이 넣어줘, 서론을 짧게 하고 근거를 강화해줘, 고1 수준 표현으로 바꿔줘.
            </p>
            <textarea
              className={`${inputClass} mt-4 min-h-32 resize-y bg-white`}
              maxLength={6000}
              value={instruction}
              onChange={(event) => {
                setInstruction(event.target.value);
                setError("");
              }}
              placeholder="어떻게 수정했으면 하는지 자유롭게 적어 주세요."
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button className={primaryButtonClass} disabled={loading} onClick={() => void reviseWithAi()} type="button">
                {loading ? "AI가 수정하는 중..." : "이 조건으로 AI 다시 수정"}
              </button>
              <button className={secondaryButtonClass} disabled={loading} onClick={saveAndApply} type="button">
                직접 수정한 내용 저장
              </button>
            </div>
          </div>

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
        </div>
      </div>
    </section>
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
    // Keep the in-memory editor usable if storage is unavailable.
  }
}

function removeStorage(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore restrictive browser storage failures.
  }
}

const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
const primaryButtonClass = "inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-700 px-5 py-3 text-sm font-black text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
