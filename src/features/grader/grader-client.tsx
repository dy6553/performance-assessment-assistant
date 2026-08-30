"use client";

import { useState } from "react";

import { assessmentDraftStorageKey } from "@/features/assessment/assessment-flow";
import { PdfRubricUpload } from "@/features/assessment/pdf-rubric-upload";
import { readApiResponse } from "@/lib/http/client-response";

import type { GradingResult } from "./schemas";

type RouteMeta = {
  model: string;
  fallback: string | null;
  reason: string;
  registryPolicy: string;
  liveCatalogChecked: boolean;
};

const strictnessOptions = [
  { value: 1, title: "관대", description: "부분 충족도 넉넉히 인정" },
  { value: 2, title: "약간 관대", description: "노력과 부분 충족을 비교적 인정" },
  { value: 3, title: "보통", description: "평가기준을 일반적인 수준으로 적용" },
  { value: 4, title: "엄격", description: "명확한 충족 근거가 있어야 인정" },
  { value: 5, title: "매우 엄격", description: "모호함과 누락을 크게 감점" },
] as const;

export function GraderClient() {
  const [rubricText, setRubricText] = useState("");
  const [submissionText, setSubmissionText] = useState("");
  const [strictness, setStrictness] = useState(3);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function grade() {
    if (rubricText.trim().length < 10) {
      setError("평가기준표 PDF를 올리거나 평가기준을 입력해 주세요.");
      return;
    }
    if (submissionText.trim().length < 20) {
      setError("채점할 수행평가 결과물을 20자 이상 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/assignment/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubricText, submissionText, strictness }),
      });
      const payload = await readApiResponse<{
        data?: GradingResult;
        route?: RouteMeta;
        error?: string;
      }>(response, "AI 채점을 완료하지 못했습니다.");

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "AI 채점을 완료하지 못했습니다.");
      }
      setResult(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI 채점 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function importCurrentDraft() {
    try {
      const raw = window.localStorage.getItem(assessmentDraftStorageKey);
      if (!raw) {
        setError("현재 저장된 AI 초안이 없습니다. 결과물을 직접 붙여 넣어 주세요.");
        return;
      }

      const parsed = JSON.parse(raw) as {
        title?: unknown;
        sections?: Array<{ heading?: unknown; body?: unknown }>;
      };
      const title = typeof parsed.title === "string" ? parsed.title.trim() : "";
      const sections = Array.isArray(parsed.sections)
        ? parsed.sections
            .map((section) => {
              const heading = typeof section.heading === "string" ? section.heading.trim() : "";
              const body = typeof section.body === "string" ? section.body.trim() : "";
              return [heading, body].filter(Boolean).join("\n");
            })
            .filter(Boolean)
        : [];
      const text = [title, ...sections].filter(Boolean).join("\n\n");

      if (text.length < 20) {
        setError("저장된 초안을 불러올 수 없습니다. 결과물을 직접 붙여 넣어 주세요.");
        return;
      }

      setSubmissionText(text);
      setResult(null);
      setError("");
    } catch {
      setError("저장된 초안을 읽지 못했습니다. 결과물을 직접 붙여 넣어 주세요.");
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header>
        <p className="text-sm font-black text-violet-700">AI 채점</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">평가기준표로 수행평가 채점</h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">
          평가기준표를 올리고 결과물을 입력하면 평가항목별 점수와 감점 이유를 계산합니다. 채점 엄격도는 5단계로 조절할 수 있습니다.
        </p>
      </header>

      <section className="mt-7 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">1. 평가기준표</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">채점 기준을 먼저 등록하세요</h2>
        </div>

        <div className="mt-5">
          <PdfRubricUpload
            disabled={loading}
            documentTypes={["rubric"]}
            onExtracted={(text) => {
              setRubricText(text);
              setResult(null);
              setError("");
            }}
          />
        </div>

        <label className="mt-5 block">
          <span className="text-sm font-black text-slate-800">판독된 평가기준</span>
          <textarea
            className="mt-2 min-h-36 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
            onChange={(event) => {
              setRubricText(event.target.value);
              setResult(null);
            }}
            placeholder="평가기준표를 올리면 여기에 자동으로 들어옵니다. 직접 입력해도 됩니다."
            value={rubricText}
          />
        </label>
      </section>

      <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">2. 결과물</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">채점할 수행평가 내용을 넣으세요</h2>
          </div>
          <button
            className="min-h-11 rounded-xl border border-violet-200 bg-violet-50 px-4 text-sm font-black text-violet-700 transition hover:bg-violet-100"
            disabled={loading}
            onClick={importCurrentDraft}
            type="button"
          >
            현재 AI 초안 불러오기
          </button>
        </div>

        <textarea
          className="mt-5 min-h-72 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold leading-7 text-slate-900 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
          onChange={(event) => {
            setSubmissionText(event.target.value);
            setResult(null);
          }}
          placeholder="보고서, 발표문, 탐구 결과 등 실제 제출할 내용을 붙여 넣으세요."
          value={submissionText}
        />
        <p className="mt-2 text-right text-xs font-bold text-slate-400">{submissionText.length.toLocaleString()}자</p>
      </section>

      <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">3. 채점 엄격도</p>
          <h2 className="mt-2 text-xl font-black text-slate-950">얼마나 깐깐하게 채점할까요?</h2>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-5" role="radiogroup" aria-label="채점 엄격도">
          {strictnessOptions.map((option) => {
            const active = strictness === option.value;
            return (
              <button
                aria-checked={active}
                className={`min-h-32 rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-violet-500 bg-violet-100 text-violet-950 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200 hover:bg-violet-50"
                }`}
                disabled={loading}
                key={option.value}
                onClick={() => {
                  setStrictness(option.value);
                  setResult(null);
                }}
                role="radio"
                type="button"
              >
                <span className="block text-lg font-black">{option.value}단계</span>
                <span className="mt-1 block text-sm font-black">{option.title}</span>
                <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">{option.description}</span>
              </button>
            );
          })}
        </div>

        {error ? <p className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700" role="alert">{error}</p> : null}

        <button
          className="mt-6 min-h-14 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 text-base font-black text-white shadow-lg shadow-violet-200 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          onClick={() => void grade()}
          type="button"
        >
          {loading ? "평가기준표와 결과물을 비교해 채점 중..." : "AI 채점 시작"}
        </button>
        <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
          AI가 계산한 예상 점수입니다. 실제 교사 채점 결과와 다를 수 있으므로 감점 근거를 함께 확인하세요.
        </p>
      </section>

      {result ? <GradingResultView result={result} /> : null}
    </main>
  );
}

function GradingResultView({ result }: { result: GradingResult }) {
  return (
    <section className="mt-6 rounded-[2rem] border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">AI 예상 채점 결과</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">{result.rubricTitle}</h2>
          <p className="mt-2 text-sm font-bold text-violet-700">{result.strictnessLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black tracking-[-0.05em] text-violet-700">
            {formatScore(result.score)}<span className="text-xl text-slate-400"> / {formatScore(result.maxScore)}</span>
          </p>
          <p className="mt-1 text-sm font-black text-slate-500">{formatScore(result.percentage)}%</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {result.criteria.map((criterion, index) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-4" key={`${criterion.criterion}-${index}`}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-black text-slate-900">{criterion.criterion}</h3>
              <p className="shrink-0 text-sm font-black text-violet-700">
                {formatScore(criterion.earnedScore)} / {formatScore(criterion.maxScore)}
              </p>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{criterion.reason}</p>
            {criterion.evidence.length ? (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">채점 근거</p>
                <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-slate-600">
                  {criterion.evidence.map((item, evidenceIndex) => <li key={evidenceIndex}>• {item}</li>)}
                </ul>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <ResultList title="잘한 점" items={result.strengths} />
        <ResultList title="감점된 이유" items={result.deductions} />
        <ResultList title="점수 올리는 방법" items={result.nextActions} />
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4">
        <p className="text-sm font-black text-slate-900">총평</p>
        <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">{result.overallFeedback}</p>
      </div>

      {result.warnings.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-black text-amber-900">확인 필요</p>
          <ul className="mt-2 space-y-1 text-sm font-semibold leading-6 text-amber-800">
            {result.warnings.map((warning, index) => <li key={index}>• {warning}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-600">
          {items.map((item, index) => <li key={index}>• {item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-sm font-semibold text-slate-400">해당 항목이 없습니다.</p>
      )}
    </div>
  );
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
