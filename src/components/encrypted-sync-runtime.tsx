"use client";

import { useEffect, useState } from "react";

import { installSyncListeners, syncNow } from "@/lib/sync/client";
import type { SyncStatus } from "@/lib/sync/types";

const LABELS: Record<SyncStatus, string> = {
  idle: "동기화 완료",
  syncing: "백업 중…",
  offline: "오프라인 · 기기에 저장됨",
  failed: "동기화 실패 · 자동 재시도",
  conflict: "충돌 있음",
  "needs-key": "기기 연결 승인 대기 중",
};

export function EncryptedSyncRuntime({ enabled }: { enabled: boolean }) {
  const [status, setStatus] = useState<SyncStatus>(navigator.onLine ? "idle" : "offline");
  const [lastSyncAt, setLastSyncAt] = useState<string>();
  useEffect(() => {
    if (!enabled) return;
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<{ status: SyncStatus; lastSyncAt?: string }>).detail;
      if (detail?.status) setStatus(detail.status);
      if (detail?.lastSyncAt) setLastSyncAt(detail.lastSyncAt);
    };
    window.addEventListener("assessment-sync-state", onState);
    const uninstall = installSyncListeners();
    return () => { window.removeEventListener("assessment-sync-state", onState); uninstall(); };
  }, [enabled]);
  if (!enabled) return null;
  return (
    <button
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-40 min-h-11 rounded-full border border-violet-200 bg-white/95 px-3 py-2 text-xs font-black text-violet-800 shadow-md backdrop-blur md:bottom-5 md:right-5"
      onClick={() => void syncNow()}
      title={lastSyncAt ? `마지막 동기화: ${new Date(lastSyncAt).toLocaleString("ko-KR")}` : "눌러서 지금 동기화"}
      type="button"
    >
      {LABELS[status]}
    </button>
  );
}
