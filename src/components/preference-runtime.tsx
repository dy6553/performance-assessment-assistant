"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  CACHE_CLEANUP_DAYS_KEY,
  CACHE_LAST_CLEANUP_KEY,
  CACHE_LIMIT_MB_KEY,
  DATA_SAVER_KEY,
  FAST_RESPONSE_KEY,
  FONT_SIZE_KEY,
  HAPTIC_KEY,
  HIGH_CONTRAST_KEY,
  LARGE_CONTROLS_KEY,
  REDUCE_MOTION_KEY,
  START_PAGE_KEY,
  START_SESSION_KEY,
  WAKE_KEY,
  readAssignmentDefaultPreferences,
  safeCacheLimit,
  safeCleanupDays,
  safeFontSize,
  safeStartPage,
  type StartPagePreference,
} from "@/lib/client-preferences";

const startPaths = {
  home: "/",
  auto: "/assignment/setup/auto",
  report: "/assignment/setup/report",
  presentation: "/assignment/setup/presentation",
  experiment: "/assignment/setup/experiment",
} as const;

const assignmentTypes = {
  auto: "자동 분석",
  report: "조사·보고서",
  presentation: "발표·토론",
  experiment: "실험·탐구",
} as const;

const assignmentFlowStorageKey = "assessment-wizard-draft-v1";
const generatedResultKeys = [
  "assessment-wizard-analysis-v1",
  "assessment-wizard-generated-draft-v1",
  "assessment-wizard-verification-v1",
] as const;

type AssignmentSlug = keyof typeof assignmentTypes;
type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

export function PreferenceRuntime() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    applyVisualPreferences();

    const handlePreferenceChange = () => applyVisualPreferences();
    window.addEventListener("assessment-preference-change", handlePreferenceChange);
    return () => window.removeEventListener("assessment-preference-change", handlePreferenceChange);
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const fastFetch: typeof window.fetch = (input, init) => {
      if (localStorage.getItem(FAST_RESPONSE_KEY) !== "1" || !isAssignmentApiRequest(input)) {
        return originalFetch(input, init);
      }

      const headers = new Headers(input instanceof Request ? input.headers : undefined);
      if (init?.headers) {
        new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      }
      headers.set("x-assessment-fast-response", "1");
      return originalFetch(input, { ...init, headers });
    };

    window.fetch = fastFetch;
    return () => {
      if (window.fetch === fastFetch) window.fetch = originalFetch;
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;
    if (sessionStorage.getItem(START_SESSION_KEY) === "1") return;

    sessionStorage.setItem(START_SESSION_KEY, "1");
    const startPage = safeStartPage(localStorage.getItem(START_PAGE_KEY));
    const target = startPaths[startPage];
    if (target !== "/") {
      seedAssignmentDraft(startPage);
      router.replace(target);
    }
  }, [pathname, router]);

  useEffect(() => {
    function handleAction(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const setupLink = target.closest('a[href^="/assignment/setup/"]');
      if (setupLink instanceof HTMLAnchorElement) {
        const slug = setupLink.getAttribute("href")?.split("/").filter(Boolean).at(-1);
        if (isAssignmentSlug(slug)) seedAssignmentDraft(slug);
      }

      if (localStorage.getItem(HAPTIC_KEY) !== "1" || !("vibrate" in navigator)) return;
      if (target.closest("button, a, [role='button']")) navigator.vibrate(10);
    }

    document.addEventListener("click", handleAction, { passive: true });
    return () => document.removeEventListener("click", handleAction);
  }, []);

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    async function syncWakeLock() {
      if (sentinel) {
        await sentinel.release().catch(() => undefined);
        sentinel = null;
      }
      if (cancelled || document.visibilityState !== "visible" || localStorage.getItem(WAKE_KEY) !== "1") return;

      const wakeNavigator = navigator as WakeLockNavigator;
      if (!wakeNavigator.wakeLock) return;
      sentinel = await wakeNavigator.wakeLock.request("screen").catch(() => null);
    }

    void syncWakeLock();
    const onVisibilityChange = () => void syncWakeLock();
    const onPreferenceChange = () => void syncWakeLock();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("assessment-preference-change", onPreferenceChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("assessment-preference-change", onPreferenceChange);
      if (sentinel) void sentinel.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    void maybeCleanCaches();
  }, []);

  return null;
}

function isAssignmentApiRequest(input: RequestInfo | URL) {
  try {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/api/assignment/");
  } catch {
    return false;
  }
}

function isAssignmentSlug(value: string | undefined): value is AssignmentSlug {
  return value === "auto" || value === "report" || value === "presentation" || value === "experiment";
}

function seedAssignmentDraft(slugOrStartPage: AssignmentSlug | StartPagePreference) {
  if (slugOrStartPage === "home") return;
  const slug = slugOrStartPage as AssignmentSlug;
  const defaults = readAssignmentDefaultPreferences();
  const assignment = {
    curriculum: defaults.curriculum,
    schoolLevel: defaults.schoolLevel,
    grade: defaults.grade,
    subject: defaults.subject,
    course: "",
    assignmentType: assignmentTypes[slug],
    topic: "",
    teacherInstruction: "",
    rubricText: "",
    achievementStandardText: "",
    requiredElements: "",
    lengthRule: "",
    formatRule: "",
    studentIdeas: "",
  };

  sessionStorage.setItem(assignmentFlowStorageKey, JSON.stringify(assignment));
  generatedResultKeys.forEach((key) => sessionStorage.removeItem(key));
}

function applyVisualPreferences() {
  const root = document.documentElement;
  root.dataset.fontSize = safeFontSize(localStorage.getItem(FONT_SIZE_KEY));
  root.dataset.reduceMotion = localStorage.getItem(REDUCE_MOTION_KEY) === "1" ? "true" : "false";
  root.dataset.highContrast = localStorage.getItem(HIGH_CONTRAST_KEY) === "1" ? "true" : "false";
  root.dataset.largeControls = localStorage.getItem(LARGE_CONTROLS_KEY) === "1" ? "true" : "false";
  root.dataset.dataSaver = localStorage.getItem(DATA_SAVER_KEY) === "1" ? "true" : "false";
  root.dataset.fastResponse = localStorage.getItem(FAST_RESPONSE_KEY) === "1" ? "true" : "false";
}

async function maybeCleanCaches() {
  if (!("caches" in window)) return;

  const cleanupDays = safeCleanupDays(localStorage.getItem(CACHE_CLEANUP_DAYS_KEY));
  const cacheLimit = safeCacheLimit(localStorage.getItem(CACHE_LIMIT_MB_KEY));
  const lastCleanup = Number(localStorage.getItem(CACHE_LAST_CLEANUP_KEY) ?? 0);
  const now = Date.now();
  let shouldClean = false;

  if (cleanupDays !== "off") {
    const interval = Number(cleanupDays) * 24 * 60 * 60 * 1000;
    shouldClean = !Number.isFinite(lastCleanup) || now - lastCleanup >= interval;
  }

  if (!shouldClean && cacheLimit !== "off" && navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate().catch(() => null);
    const usage = estimate?.usage ?? 0;
    shouldClean = usage > Number(cacheLimit) * 1024 * 1024;
  }

  if (!shouldClean) return;
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
  localStorage.setItem(CACHE_LAST_CLEANUP_KEY, String(now));
}
