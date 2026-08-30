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

async function sendSystemNotification(label: string, failed: boolean) {
  if (!canUseNotifications() || Notification.permission !== "granted") return;

  const title = failed ? `${label}에 실패했습니다` : `${label}이 완료되었습니다`;
  const options: NotificationOptions = {
    body: failed
      ? "수행평가 도우미로 돌아와 오류 내용을 확인해 주세요."
      : "결과가 준비되었습니다. 수행평가 도우미에서 확인해 주세요.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `assessment-${label}`,
    data: { url: window.location.href },
  };

  // 모바일/PWA에서는 `new Notification()`이 금지되는 경우가 있으므로
  // 서비스 워커 알림을 우선 사용합니다. 앱이 켜져 있어도 완료 알림을 보냅니다.
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, options);
      return;
    } catch (error) {
      console.info("Service-worker notification is unavailable.", error);
    }
  }

  try {
    const notification = new Notification(title, options);
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
        setProgress({ label: task.label, startedAt, expectedMs: task.expectedMs, done: true, failed });
        void sendSystemNotification(task.label, failed);
        window.setTimeout(() => {
          setProgress((current) => current?.startedAt === startedAt ? null : current);
        }, failed ? 5_000 : 4_000);
        return response;
      } catch (error) {
        const finishedAt = Date.now();
        setNow(finishedAt);
        setProgress({ label: task.label, startedAt, expectedMs: task.expectedMs, done: true, failed: true });
        void sendSystemNotification(task.label, true);
        window.setTimeout(() => {
          setProgress((current) => current?.startedAt === startedAt ? null : current);
        }, 5_000);

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
    if (progress.done) return { percent: 100, remainingSeconds: 0, delayed: false };

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
      className={`fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.2rem)] z-[80] mx-auto max-w-sm rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur sm:bottom-4 ${progress.failed ? "border-rose-300 bg-rose-950/95 text-white" : progress.done ? "border-emerald-300 bg-emerald-950/95 text-white" : "border-violet-300 bg-slate-950/95 text-white"}`}
      role="status"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-black">
              {progress.failed ? `${progress.label} 실패` : progress.done ? `${progress.label} 완료` : `${progress.label} 진행 중`}
            </p>
            <span className="shrink-0 text-sm font-black tabular-nums">
              {progress.failed ? "오류" : `${view.percent}%`}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-bold text-white/70">
            {progress.failed
              ? "화면의 오류 내용을 확인해 주세요."
              : progress.done
                ? "결과가 준비되었습니다."
                : view.delayed
                  ? "예상 시간 초과 · 서버 응답 대기 중"
                  : `예상 약 ${view.remainingSeconds}초 남음`}
          </p>
          {!progress.done ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="h-full rounded-full bg-white transition-[width] duration-500 ease-out" style={{ width: `${view.percent}%` }} />
            </div>
          ) : null}
        </div>
      </div>

      {notificationPermission === "default" && !progress.done ? (
        <button
          className="mt-2 inline-flex min-h-8 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-2.5 text-[11px] font-black text-white"
          onClick={() => void enableNotifications()}
          type="button"
        >
          완료 알림 켜기
        </button>
      ) : null}
    </aside>
  );
}
