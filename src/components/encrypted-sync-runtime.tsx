"use client";

import { useEffect } from "react";

import { installSyncListeners } from "@/lib/sync/client";

export function EncryptedSyncRuntime({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    const uninstall = installSyncListeners();
    return uninstall;
  }, [enabled]);
  return null;
}
