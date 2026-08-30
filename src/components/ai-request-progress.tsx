"use client";

import { useEffect, useMemo, useState } from "react";

type ProgressState = {
  label: string;
  startedAt: number;
  expectedMs: number;
  done: boolean;
  failed: boolean;
};

const assignmentTasks: Array<{
  path: string;
  label: string;
  expectedMs: number;
}> = [
  { path: "/api/assignment/recommend-topic", label: "AI 주제 추천", expectedMs: 20_000 },
  { path: "/api/assignment/analyze", label: "과제 분석", expectedMs: 35_000 },
  { path: "/api/assignment/generate", label: "초안 작성", expectedMs: 45_000 },
  { path: "/api/assignment/verify", label: "초안 독립 검증", expectedMs: 55_000 },
];

export function AiRequestProgress() {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const pathname = (() => {
        try {
          return new URL(url, window.location.origin).pathname;
        } catch {
          return url;
        }
      })();
      const task = assignmentTasks.find((item) => pathname === item.path);

      if (!task) return originalFetch(input, init);

      const startedAt = Date.now();
      setNow(startedAt);
      setProgress({ label: task.label, startedAt, expectedMs: task.expectedMs, done: false, failed: false });

      try {
        const response = await originalFetch(input, init);
        const finishedAt = Date.now();
        setNow(finishedAt);
        setProgress({
          label: task.label,
          startedAt,
          expectedMs: task.expectedMs,
          done: true,
          failed: !response.ok,
        });
        window.setTimeout(() => {
          setProgress((current) => current?.startedAt === startedAt ? null : current);
        }, response.ok ? 1_200 : 3_500);
        return response;
      } catch (error) {
        const finishedAt = Date.now();
        setNow(finishedAt);
        setProgress({ label: task.label, startedAt, expectedMs: task.expectedMs, done: true, failed: true });
        window.setTimeout(() => {
          setProgress((current) => current?.startedAt === startedAt ? null : current);
        }, 3_500);

        if (error instanceof TypeError) {
          throw new Error("서버와 연결이 끊겼습니다. 잠시 후 다시 시도해 주세요. 계속 실패하면 페이지를 새로고침한 뒤 다시 실행해 주세요.");
        }
        throw error;
      }
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (!progress || progress.done) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [progress]);

  const view = useMemo(() => {
    if (!progress) return null;
    if (progress.done) {
      return { percent: progress.failed ? 100 : 100, remainingSeconds: 0, delayed: false };
    }

    const elapsed = Math.max(0, now - progress.startedAt);
    const ratio = elapsed / progress.expectedMs;
    // 실제 서버 진행률을 받을 수 없으므로 시간 기반 추정치입니다. 완료 전에는 95%에서 멈춥니다.
    const percent = Math.min(95, Math.max(3, Math.round((1 - Math.exp(-2.6 * ratio)) * 100)));
    const remainingSeconds = Math.max(0, Math.ceil((progress.expectedMs - elapsed) / 1_000));
    return { percent, remainingSeconds, delayed: elapsed > progress.expectedMs };
  }, [now, progress]);

  if (!progress || !view) return null;

  return (
    <aside
      aria-live="polite"
      className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-[80] mx-auto max-w-md rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur sm:bottom-6 ${progress.failed ? "border-rose-200" : "border-violet-200"}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-950">
            {progress.failed ? `${progress.label} 실패` : progress.done ? `${progress.label} 완료` : `${progress.label} 진행 중`}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {progress.failed
              ? "요청 처리 중 오류가 발생했습니다. 화면의 오류 메시지를 확인해 주세요."
              : progress.done
                ? "처리가 완료되었습니다."
                : view.delayed
                  ? "예상 시간보다 오래 걸리고 있습니다. 서버 응답을 기다리는 중입니다."
                  : `예상 남은 시간 약 ${view.remainingSeconds}초`}
          </p>
        </div>
        <span className={`shrink-0 text-lg font-black tabular-nums ${progress.failed ? "text-rose-700" : "text-violet-700"}`}>
          {progress.failed ? "오류" : `${view.percent}%`}
        </span>
      </div>

      <div className={`mt-3 h-2.5 overflow-hidden rounded-full ${progress.failed ? "bg-rose-100" : "bg-violet-100"}`} aria-hidden="true">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${progress.failed ? "bg-rose-500" : "bg-violet-600"}`}
          style={{ width: `${view.percent}%` }}
        />
      </div>
      {!progress.done ? (
        <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-400">진행률과 남은 시간은 실제 서버 단계가 아닌 평균 처리 시간을 기준으로 한 예상치입니다.</p>
      ) : null}
    </aside>
  );
}
