"use client";

import { useEffect, useState } from "react";

export function CopyButton({ text, label = "복사", className = "" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timeout = window.setTimeout(() => setState("idle"), 2_000);
    return () => window.clearTimeout(timeout);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  const visibleLabel = state === "copied" ? "복사됨" : state === "failed" ? "복사 실패" : label;
  return (
    <button aria-live="polite" className={className} onClick={() => void copy()} type="button">
      {visibleLabel}
    </button>
  );
}
