"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
} from "@/features/assessment/assessment-flow";
import {
  analysisResultSchema,
  assignmentInputSchema,
  draftResultSchema,
  type AnalysisResult,
  type AssignmentInput,
  type DraftResult,
  type VerificationResult,
} from "@/features/assessment/schemas";
import { readApiResponse } from "@/lib/http/client-response";

import { Icon } from "./icons";

type EditableTarget = "assignment" | "analysis" | "draft" | "none";
type ChatMessage = { role: "user" | "assistant"; content: string };
type AiChange = { id: string; path: string; title: string; description: string; value: unknown };
type AssistantResult = {
  reply: string;
  target: EditableTarget;
  changes: AiChange[];
  proposedValue: unknown | null;
};

const chatStorageKey = "assessment-ai-chat-v1";

export function AiAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => []);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const stage = useMemo(() => describeStage(pathname), [pathname]);

  function showAssistant() {
    setOpen(true);
    setMessages(readSession<ChatMessage[]>(chatStorageKey) ?? []);
  }

  async function submit() {
    const message = input.trim();
    if (!message || loading) return;

    const context = readContext(pathname);
    const recent = messages.slice(-12);
    const nextMessages: ChatMessage[] = [...recent, { role: "user", content: message }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/assignment/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathname,
          stage,
          userMessage: message,
          messages: recent,
          ...context,
        }),
      });
      const payload = await readApiResponse<{ data?: AssistantResult; error?: string }>(response, "AI 도우미 답변을 받지 못했습니다.");
      if (!response.ok || !payload.data) throw new Error(payload.error || "AI 도우미 답변을 받지 못했습니다.");

      const assistantMessage: ChatMessage = { role: "assistant", content: payload.data.reply };
      const saved = [...nextMessages, assistantMessage].slice(-20);
      setMessages(saved);
      writeSession(chatStorageKey, saved);
      setResult(payload.data);
      setSelected(payload.data.changes.map((change) => change.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI 도우미 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function applyAll() {
    if (!result?.proposedValue || result.target === "none") return;
    persistTarget(result.target, result.proposedValue);
  }

  function applySelected() {
    if (!result || result.target === "none" || !selected.length) return;
    const context = readContext(pathname);
    const current = context[result.target];
    if (!current) {
      setError("현재 결과물을 불러오지 못해 반영할 수 없습니다.");
      return;
    }

    try {
      const next = structuredClone(current) as Record<string, unknown>;
      for (const change of result.changes) {
        if (selected.includes(change.id)) setAtJsonPointer(next, change.path, change.value);
      }
      const schema = result.target === "assignment" ? assignmentInputSchema : result.target === "analysis" ? analysisResultSchema : draftResultSchema;
      const checked = schema.safeParse(next);
      if (!checked.success) {
        setError("선택한 항목만 적용하면 결과 형식이 맞지 않습니다. 함께 필요한 항목을 더 선택하거나 전체 반영을 이용해 주세요.");
        return;
      }
      persistTarget(result.target, checked.data);
    } catch {
      setError("선택한 수정 사항을 반영하지 못했습니다. 전체 반영을 이용하거나 직접 수정해 주세요.");
    }
  }

  function persistTarget(target: Exclude<EditableTarget, "none">, value: unknown) {
    const key = target === "assignment" ? assessmentFlowStorageKey : target === "analysis" ? assessmentAnalysisStorageKey : assessmentDraftStorageKey;
    writeSession(key, value);
    if (target === "assignment") {
      removeSession(assessmentAnalysisStorageKey);
      removeSession(assessmentDraftStorageKey);
    }
    removeSession(assessmentVerificationStorageKey);
    window.location.reload();
  }

  function clearChat() {
    setMessages([]);
    setResult(null);
    removeSession(chatStorageKey);
  }

  return (
    <>
      <button
        aria-label="AI 도우미 열기"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.4rem)] right-4 z-[60] inline-flex min-h-13 items-center gap-2 rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-xl transition hover:scale-[1.02] active:scale-[0.97] md:bottom-6 md:right-6"
        onClick={showAssistant}
        type="button"
      >
        <Icon className="size-5" name="sparkles" />
        AI 도우미
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-sm" role="presentation">
          <section aria-label="AI 도우미" aria-modal="true" className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[2rem] border border-violet-100 bg-white shadow-2xl md:inset-y-4 md:left-auto md:right-4 md:w-[30rem] md:rounded-[2rem]" role="dialog">
            <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-black text-violet-600">현재 단계 · {stage}</p>
                <h2 className="mt-1 text-xl font-black text-slate-950">AI 도우미</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">지금까지의 입력·분석·초안·검증 내용을 함께 참고합니다.</p>
              </div>
              <button aria-label="닫기" className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600" onClick={() => setOpen(false)} type="button">
                <Icon className="size-5" name="close" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              {!messages.length ? (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-sm font-black text-violet-950">무엇을 도와드릴까요?</p>
                  <p className="mt-1 text-sm leading-6 text-violet-700">진행 상황 점검, 표현 수정, 아이디어 제안, 문제점 분석을 요청할 수 있습니다.</p>
                </div>
              ) : null}
              {messages.map((message, index) => (
                <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`} key={`${message.role}-${index}`}>
                  <p className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm font-semibold leading-6 ${message.role === "user" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700"}`}>{message.content}</p>
                </div>
              ))}
              {loading ? <p className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-black text-violet-700">현재 단계와 이전 내용을 확인해 답변하는 중입니다...</p> : null}

              {result?.changes.length ? (
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <h3 className="font-black text-emerald-900">반영할 수정 사항을 선택하세요</h3>
                  <div className="mt-3 space-y-2">
                    {result.changes.map((change) => (
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3" key={change.id}>
                        <input checked={selected.includes(change.id)} className="mt-1 size-4" onChange={(event) => setSelected((current) => event.target.checked ? [...current, change.id] : current.filter((id) => id !== change.id))} type="checkbox" />
                        <span>
                          <span className="block text-sm font-black text-slate-900">{change.title}</span>
                          <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{change.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button className="min-h-11 rounded-xl border border-emerald-300 bg-white px-3 text-sm font-black text-emerald-800 disabled:opacity-50" disabled={!selected.length} onClick={applySelected} type="button">선택 반영</button>
                    <button className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white" onClick={applyAll} type="button">전체 반영</button>
                  </div>
                  <button className="mt-2 min-h-10 w-full rounded-xl text-xs font-black text-slate-500" onClick={() => setResult(null)} type="button">반영하지 않기</button>
                </section>
              ) : null}
              {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
            </div>

            <footer className="border-t border-slate-200 p-4 sm:p-5">
              <textarea className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" maxLength={6000} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="현재 결과에서 무엇을 점검하거나 수정할까요?" value={input} />
              <div className="mt-3 flex items-center justify-between gap-3">
                <button className="text-xs font-black text-slate-400" onClick={clearChat} type="button">대화 초기화</button>
                <button className="min-h-11 rounded-xl bg-violet-700 px-5 text-sm font-black text-white disabled:opacity-50" disabled={loading || input.trim().length < 1} onClick={() => void submit()} type="button">보내기</button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function readContext(pathname: string): {
  assignment: AssignmentInput | null;
  analysis: AnalysisResult | null;
  draft: DraftResult | null;
  verification: (VerificationResult & { readinessScore?: number }) | null;
  target: EditableTarget;
} {
  const assignment = readSession<AssignmentInput>(assessmentFlowStorageKey);
  const analysis = readSession<AnalysisResult>(assessmentAnalysisStorageKey);
  const draft = readSession<DraftResult>(assessmentDraftStorageKey);
  const verification = readSession<VerificationResult & { readinessScore?: number }>(assessmentVerificationStorageKey);
  const target: EditableTarget = draft ? "draft" : analysis ? "analysis" : assignment || pathname.startsWith("/assignment") ? "assignment" : "none";
  return { assignment, analysis, draft, verification, target };
}

function describeStage(pathname: string) {
  if (pathname.includes("/setup")) return "과제 정보 입력";
  if (pathname.includes("/topic")) return "주제 선정";
  if (pathname.includes("/review")) return "계획 확인";
  if (pathname.includes("/draft")) return "초안 작성";
  if (pathname.includes("/verification")) return "최종 검증";
  if (pathname.includes("/workspace")) return "작성 전략·자료 제작";
  if (pathname.includes("/presentation")) return "발표 준비";
  if (pathname.includes("/inquiry")) return "탐구 진행";
  if (pathname.includes("/calendar")) return "일정 관리";
  return "수행평가 준비";
}

function setAtJsonPointer(target: Record<string, unknown>, pointer: string, value: unknown) {
  if (!pointer.startsWith("/") || pointer === "/") throw new Error("INVALID_POINTER");
  const parts = pointer.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  let cursor: unknown = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (Array.isArray(cursor)) cursor = cursor[Number(key)];
    else if (cursor && typeof cursor === "object") cursor = (cursor as Record<string, unknown>)[key];
    else throw new Error("INVALID_POINTER");
  }
  const finalKey = parts.at(-1)!;
  if (Array.isArray(cursor)) cursor[Number(finalKey)] = value;
  else if (cursor && typeof cursor === "object") (cursor as Record<string, unknown>)[finalKey] = value;
  else throw new Error("INVALID_POINTER");
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
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Keep chat usable in memory. */ }
}

function removeSession(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* Ignore restricted storage. */ }
}
