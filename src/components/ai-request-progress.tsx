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

function canUseNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

function sendSystemNotification(label: string, failed: boolean) {
  if (!canUseNotifications() || Notification.permission !== "granted") return;

  // 일부 모바일 브라우저(특히 iOS/PWA 환경)는 Notification API를 노출하지만
  // `new Notification()` 생성자를 허용하지 않습니다. 알림 실패가 AI 요청 자체를
  // 실패시키지 않도록 best-effort 부가기능으로 격리합니다.
  try {
    const notification = new Notification(
      failed ? `${label}에 실패했습니다` : `${label}이 완료되었습니다`,
      {
        body: failed
          ? "수행평가 도우미로 돌아와 오류 내용을 확인해 주세요."
          : "결과가 준비되었습니다. 수행평가 도우미에서 확인해 주세요.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: `assessment-${label}`,
      },
    );

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.info("System notification is unavailable in this browser context.", error);
  }
}

export function AiRequestProgress() {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setNotificationPermission(canUseNotifications() ? Notification.permission : "unsupported");
  }, []);

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
        const failed = !response.ok;
        setNow(finishedAt);
        setProgress({
          label: task.label,
          startedAt,
          expectedMs: task.expectedMs,
          done: true,
          failed,
        });
        sendSystemNotification(task.label, failed);
        window.setTimeout(() => {
          setProgress((current) => current?.startedAt === startedAt ? null : current);
        }, response.ok ? 2_500 : 4_500);
        return response;
      } catch (error) {
        const finishedAt = Date.now();
        setNow(finishedAt);
        setProgress({ label: task.label, startedAt, expectedMs: task.expectedMs, done: true, failed: true });
        sendSystemNotification(task.label, true);
        window.setTimeout(() => {
          setProgress((current) => current?.startedAt === startedAt ? null : current);
        }, 4_500);

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
      return { percent: 100, remainingSeconds: 0, delayed: false };
    }

    const elapsed = Math.max(0, now - progress.startedAt);
    const ratio = elapsed / progress.expectedMs;
    const percent = Math.min(95, Math.max(3, Math.round((1 - Math.exp(-2.6 * ratio)) * 100)));
    const remainingSeconds = Math.max(0, Math.ceil((progress.expectedMs - elapsed) / 1_000));
    return { percent, remainingSeconds, delayed: elapsed > progress.expectedMs };
  }, [now, progress]);

  async function enableNotifications() {
    if (!canUseNotifications()) return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch {
      setNotificationPermission(Notification.permission);
    }
  }

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

      {notificationPermission === "default" ? (
        <button
          className="mt-3 inline-flex min-h-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-black text-violet-700"
          onClick={() => void enableNotifications()}
          type="button"
        >
          완료 시 기기 알림 받기
        </button>
      ) : null}

      {notificationPermission === "granted" && !progress.done ? (
        <p className="mt-2 text-[11px] font-semibold text-emerald-600">작업이 끝나면 지원되는 환경에서 기기 알림으로 알려드립니다.</p>
      ) : null}
    </aside>
  );
}
