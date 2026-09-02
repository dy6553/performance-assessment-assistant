"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  resultPath?: string;
}> = [
  { path: "/api/assignment/recommend-topic", label: "AI 주제 추천", expectedMs: 20_000 },
  { path: "/api/assignment/analyze", label: "과제 분석", expectedMs: 35_000 },
  { path: "/api/assignment/generate", label: "초안 작성", expectedMs: 45_000, resultPath: "/assignment/draft" },
  { path: "/api/assignment/verify", label: "초안 독립 검증", expectedMs: 55_000, resultPath: "/assignment/verification" },
];

const topicOptionsStorageKey = "assessment-topic-reroll-options-v1";

const difficultyOptions = [
  { value: 1, label: "1 · 매우 쉬움" },
  { value: 2, label: "2 · 쉬움" },
  { value: 3, label: "3 · 기본보다 쉬움" },
  { value: 4, label: "4 · 보통" },
  { value: 5, label: "5 · 조금 어려움" },
  { value: 6, label: "6 · 어려움" },
  { value: 7, label: "7 · 심화" },
] as const;

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

function findTopicRecommendationCard(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll("h2")).find(
    (element) => element.textContent?.trim() === "AI 주제 추천",
  );
  if (!(heading instanceof HTMLElement)) return null;

  let current: HTMLElement | null = heading.parentElement;
  while (current) {
    if (typeof current.className === "string" && current.className.includes("rounded-[1.75rem]")) {
      return current;
    }
    current = current.parentElement;
  }
  return heading.parentElement;
}

export function AiRequestProgress() {
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [topicRequest, setTopicRequest] = useState("");
  const [topicDifficulty, setTopicDifficulty] = useState(4);
  const [topicCard, setTopicCard] = useState<HTMLElement | null>(null);
  const topicRequestRef = useRef("");
  const topicDifficultyRef = useRef(4);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setNotificationPermission(canUseNotifications() ? Notification.permission : "unsupported");

      try {
        const stored = sessionStorage.getItem(topicOptionsStorageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as { request?: unknown; difficulty?: unknown };
          if (typeof parsed.request === "string") setTopicRequest(parsed.request);
          if (typeof parsed.difficulty === "number" && parsed.difficulty >= 1 && parsed.difficulty <= 7) {
            setTopicDifficulty(Math.round(parsed.difficulty));
          }
        }
      } catch {
        // 세션 저장소를 사용할 수 없는 환경에서는 기본값으로 계속 진행합니다.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    topicRequestRef.current = topicRequest;
    topicDifficultyRef.current = topicDifficulty;
    try {
      sessionStorage.setItem(
        topicOptionsStorageKey,
        JSON.stringify({ request: topicRequest, difficulty: topicDifficulty }),
      );
    } catch {
      // 저장 실패는 추천 기능 자체를 막지 않습니다.
    }
  }, [topicDifficulty, topicRequest]);

  useEffect(() => {
    const updateTarget = () => {
      if (window.location.pathname !== "/assignment/topic") {
        setTopicCard(null);
        return;
      }
      setTopicCard(findTopicRecommendationCard());
    };

    updateTarget();
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", updateTarget);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", updateTarget);
    };
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

      let nextInit = init;
      if (pathname === "/api/assignment/recommend-topic" && typeof init?.body === "string") {
        try {
          const payload = JSON.parse(init.body) as Record<string, unknown>;
          const existing = typeof payload.additionalConditions === "string" ? payload.additionalConditions.trim() : "";
          const request = topicRequestRef.current.trim();
          const difficulty = Math.min(7, Math.max(1, Math.round(topicDifficultyRef.current)));
          const extraConditions = [
            existing,
            request ? `포함 키워드/요청사항: ${request}` : "",
            `원하는 주제 수준: 7단계 중 ${difficulty}단계. 학년 기준 난이도를 이 수준에 맞출 것.`,
          ]
            .filter(Boolean)
            .join("\n");

          nextInit = {
            ...init,
            body: JSON.stringify({ ...payload, additionalConditions: extraConditions }),
          };
        } catch {
          nextInit = init;
        }
      }

      const startedAt = Date.now();
      setNow(startedAt);
      setProgress({ label: task.label, startedAt, expectedMs: task.expectedMs, done: false, failed: false });

      try {
        const response = await originalFetch(input, nextInit);
        const finishedAt = Date.now();
        const failed = !response.ok;
        setNow(finishedAt);
        setProgress({ label: task.label, startedAt, expectedMs: task.expectedMs, done: true, failed });
        void sendSystemNotification(task.label, failed);

        if (!failed && task.resultPath && window.location.pathname === "/assignment/workspace") {
          window.setTimeout(() => {
            if (window.location.pathname === "/assignment/workspace") {
              window.location.assign(task.resultPath!);
            }
          }, 900);
        }

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

  const topicOptions = topicCard
    ? createPortal(
        <div className="mx-5 mb-5 mt-4 grid gap-3 border-t border-violet-200/70 pt-4 sm:grid-cols-[1fr_12rem]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-violet-900">포함 키워드 / 요청사항 (선택)</span>
            <input
              className="min-h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              maxLength={500}
              onChange={(event) => setTopicRequest(event.target.value)}
              placeholder="예: 반도체 포함, 실험 없이 조사형"
              value={topicRequest}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-black text-violet-900">주제 수준 · 7단계</span>
            <select
              className="min-h-11 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm font-black text-slate-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
              onChange={(event) => setTopicDifficulty(Number(event.target.value))}
              value={topicDifficulty}
            >
              {difficultyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <p className="text-[11px] font-semibold leading-5 text-violet-700 sm:col-span-2">
            앞에서 입력한 학년·과목·과제 조건은 그대로 사용하고, 이 두 항목만 다음 추천에 추가 반영합니다.
          </p>
        </div>,
        topicCard,
      )
    : null;

  return (
    <>
      {topicOptions}
      {progress && view ? (
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
                    ? "결과 페이지로 이동합니다."
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
      ) : null}
    </>
  );
}
