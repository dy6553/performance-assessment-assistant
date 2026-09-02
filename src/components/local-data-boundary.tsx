"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { LOCAL_PROJECT_KEYS, persistCurrentProject } from "@/lib/local-data/compat";
import { hydrateAndMigrateLocalData } from "@/lib/local-data/migration";
import { configureLocalOwner } from "@/lib/local-data/owner";

type SaveState = "idle" | "saving" | "saved" | "error";

export function LocalDataBoundary({ ownerId, children }: { ownerId: string | null; children: ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(!ownerId);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    configureLocalOwner(ownerId);
    if (!ownerId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    void hydrateAndMigrateLocalData(ownerId)
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) { setReady(true); setSaveState("error"); } });
    return () => { cancelled = true; };
  }, [ownerId]);

  useEffect(() => {
    function onSave(event: Event) {
      const state = (event as CustomEvent<{ state?: SaveState }>).detail?.state;
      if (state) setSaveState(state);
    }
    window.addEventListener("assessment-local-save-state", onSave);
    return () => window.removeEventListener("assessment-local-save-state", onSave);
  }, []);

  useEffect(() => {
    if (!ownerId || !ready) return;
    let lastSnapshot = cacheFingerprint();
    let writing = false;

    async function flushIfChanged(force = false) {
      const next = cacheFingerprint();
      if (!force && next === lastSnapshot) return;
      if (writing) return;
      writing = true;
      setSaveState("saving");
      try {
        await persistCurrentProject();
        lastSnapshot = next;
        setSaveState("saved");
      } catch {
        setSaveState("error");
      } finally {
        writing = false;
      }
    }

    const timer = window.setInterval(() => void flushIfChanged(), 450);
    const onVisibility = () => { if (document.visibilityState === "hidden") void flushIfChanged(true); };
    const onPageHide = () => void flushIfChanged(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void flushIfChanged(true);
    };
  }, [ownerId, ready]);

  const workPath = pathname.startsWith("/assignment") || pathname.startsWith("/calendar");
  if (!ready && workPath) {
    return (
      <main className="mx-auto min-h-[60dvh] max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-violet-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-black text-violet-700">이 기기의 작업 데이터를 불러오는 중입니다.</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">기존 작업이 있으면 손실 없이 IndexedDB로 이전한 뒤 계속합니다.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      {children}
      {ownerId && workPath ? (
        <div className="pointer-events-none fixed right-3 top-[4.5rem] z-40 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-black text-slate-500 shadow-sm backdrop-blur md:right-5">
          {saveState === "saving" ? "기기에 저장 중…" : saveState === "error" ? "로컬 저장 확인 필요" : "이 기기에 저장됨"}
        </div>
      ) : null}
    </>
  );
}

function cacheFingerprint() {
  try {
    return Object.values(LOCAL_PROJECT_KEYS).map((key) => window.sessionStorage.getItem(key) ?? "").join("\u001f");
  } catch {
    return "";
  }
}
