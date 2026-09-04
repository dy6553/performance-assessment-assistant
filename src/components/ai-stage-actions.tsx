"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
} from "@/features/assessment/assessment-flow";
import type {
  AnalysisResult,
  AssignmentInput,
  DraftResult,
  TopicRecommendationResult,
} from "@/features/assessment/schemas";
import { readApiResponse } from "@/lib/http/client-response";

import { Icon } from "./icons";

type Stage = "topic" | "draft" | "final";

type TopicPayload = {
  data?: TopicRecommendationResult;
  error?: string;
};

type DraftPayload = {
  data?: DraftResult;
  error?: string;
};

export function AiStageActions() {
  const pathname = usePathname();
  const stage = useMemo(() => stageForPath(pathname), [pathname]);
  const [hasDraft, setHasDraft] = useState(false);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topicResult, setTopicResult] = useState<TopicRecommendationResult | null>(null);
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasDraft(Boolean(readSession<DraftResult>(assessmentDraftStorageKey)));
      setOpen(false);
      setInstruction("");
      setError("");
      setTopicResult(null);
      setDraftResult(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  if (!stage || (stage === "draft" && !hasDraft)) return null;

  function openChat() {
    setOpen(false);
    const button = document.querySelector<HTMLButtonElement>('[aria-label="AI 도우미 열기"]');
    button?.click();
  }

  async function rerun() {
    const request = instruction.trim();
    if (request.length < 2 || loading) return;
    setLoading(true);
    setError("");
    setTopicResult(null);
    setDraftResult(null);

    try {
      if (stage === "topic") {
        const assignment = readSession<AssignmentInput>(assessmentFlowStorageKey);
        if (!assignment) throw new Error("현재 수행평가 정보를 불러오지 못했습니다.");
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
            achievementStandardText: assignment.achievementStandardText,
            requiredElements: assignment.requiredElements,
            lengthRule: assignment.lengthRule,
            formatRule: assignment.formatRule,
            studentIdeas: assignment.studentIdeas,
            interestField: "",
            desiredMajor: "",
            desiredCareer: "",
            additionalConditions: request,
            avoidTopics: [],
          }),
        });
        const payload = await readApiResponse<TopicPayload>(response, "주제를 다시 추천하지 못했습니다.");
        if (!response.ok || !payload.data) throw new Error(payload.error || "주제를 다시 추천하지 못했습니다.");
        setTopicResult(payload.data);
      } else {
        const assignment = readSession<AssignmentInput>(assessmentFlowStorageKey);
        const analysis = readSession<AnalysisResult>(assessmentAnalysisStorageKey);
        const draft = readSession<DraftResult>(assessmentDraftStorageKey);
        if (!assignment || !analysis || !draft) throw new Error("현재 초고와 작성 전략을 불러오지 못했습니다.");
        const response = await fetch("/api/assignment/revise-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignment, analysis, draft, instruction: request }),
        });
        const payload = await readApiResponse<DraftPayload>(response, "요청사항대로 다시 작성하지 못했습니다.");
        if (!response.ok || !payload.data) throw new Error(payload.error || "요청사항대로 다시 작성하지 못했습니다.");
        setDraftResult(payload.data);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI 재실행 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function applyTopic(title: string) {
    const assignment = readSession<AssignmentInput>(assessmentFlowStorageKey);
    if (!assignment) return;
    writeSession(assessmentFlowStorageKey, { ...assignment, topic: title });
    removeSession(assessmentAnalysisStorageKey);
    removeSession(assessmentDraftStorageKey);
    removeSession(assessmentVerificationStorageKey);
    window.location.reload();
  }

  function applyDraft() {
    if (!draftResult) return;
    writeSession(assessmentDraftStorageKey, draftResult);
    removeSession(assessmentVerificationStorageKey);
    window.location.reload();
  }

  const stageLabel = stage === "topic" ? "주제 선정" : stage === "final" ? "완성본" : "초고";

  return (
    <>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+9.3rem)] left-4 z-[58] flex max-w-[calc(100vw-2rem)] gap-2 md:bottom-6 md:left-6">
        <button
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-violet-200 bg-white px-4 text-sm font-black text-violet-800 shadow-lg transition active:scale-[0.98]"
          onClick={() => setOpen(true)}
          type="button"
        >
          <Icon className="size-4.5" name="sparkles" />
          요청사항대로 재실행
        </button>
        <button
          className="inline-flex min-h-12 items-center rounded-full bg-slate-950 px-4 text-sm font-black text-white shadow-lg transition active:scale-[0.98]"
          onClick={openChat}
          type="button"
        >
          Chat으로 의논
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[79] bg-slate-950/35 backdrop-blur-sm" role="presentation">
          <section className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl md:left-1/2 md:top-1/2 md:bottom-auto md:max-h-[84dvh] md:w-[38rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem] md:p-6" role="dialog" aria-modal="true" aria-label={`${stageLabel} AI 재실행`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black text-violet-600">{stageLabel} · 요청사항대로 재실행</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">원하는 수정 조건을 입력하세요</h2>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
                  {stage === "topic"
                    ? "기존 과제 조건을 유지하면서 입력한 요청을 추가로 반영해 주제를 다시 추천합니다."
                    : "현재 결과와 교사 안내·평가기준을 유지하면서 요청한 부분을 중심으로 다시 작성합니다."}
                </p>
              </div>
              <button aria-label="닫기" className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600" onClick={() => setOpen(false)} type="button">
                <Icon className="size-5" name="close" />
              </button>
            </div>

            <textarea
              className="mt-5 min-h-32 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
              maxLength={6000}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder={stage === "topic" ? "예: IT와 관련되고 학교에서 직접 조사할 수 있는 주제로 다시 추천해줘" : "예: 분량을 1,500자로 늘리고 결론을 앞 내용과 더 잘 연결해줘"}
              value={instruction}
            />
            <button className="mt-3 min-h-12 w-full rounded-2xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50" disabled={loading || instruction.trim().length < 2} onClick={() => void rerun()} type="button">
              {loading ? "AI가 다시 작업하는 중..." : "이 요청대로 재실행"}
            </button>

            {topicResult ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-black text-slate-900">새 추천 결과</p>
                {topicResult.topics.map((item, index) => (
                  <button className="w-full rounded-2xl border border-violet-100 bg-violet-50/40 p-4 text-left hover:border-violet-300" key={`${item.title}-${index}`} onClick={() => applyTopic(item.title)} type="button">
                    <span className="block text-sm font-black text-slate-950">{item.title}</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{item.rationale}</span>
                    <span className="mt-2 block text-xs font-black text-violet-700">이 주제로 반영</span>
                  </button>
                ))}
              </div>
            ) : null}

            {draftResult ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-black text-emerald-700">재실행 결과 미리보기</p>
                <h3 className="mt-1 text-lg font-black text-slate-950">{draftResult.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{draftResult.thesisOrGoal}</p>
                <div className="mt-3 space-y-2">
                  {draftResult.sections.slice(0, 4).map((section, index) => (
                    <div className="rounded-xl bg-white p-3" key={`${section.heading}-${index}`}>
                      <p className="text-sm font-black text-slate-900">{section.heading}</p>
                      <p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">{section.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button className="min-h-11 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-600" onClick={() => setDraftResult(null)} type="button">반영하지 않기</button>
                  <button className="min-h-11 rounded-xl bg-emerald-700 text-sm font-black text-white" onClick={applyDraft} type="button">이 결과로 전체 교체</button>
                </div>
              </div>
            ) : null}

            {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function stageForPath(pathname: string): Stage | null {
  if (pathname === "/assignment/topic") return "topic";
  if (pathname === "/assignment/final") return "final";
  if (pathname === "/assignment/draft" || pathname === "/assignment/workspace") return "draft";
  return null;
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
    // Keep the current UI usable when storage is restricted.
  }
}

function removeSession(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore restricted storage.
  }
}
