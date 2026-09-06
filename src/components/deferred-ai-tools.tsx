"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const LazyAiAssistant = dynamic(
  () => import("./ai-assistant").then((module) => module.AiAssistant),
  { ssr: false },
);
const LazyAiStageActions = dynamic(
  () => import("./ai-stage-actions").then((module) => module.AiStageActions),
  { ssr: false },
);

export function DeferredAiTools() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 1_200);
    return () => window.clearTimeout(timer);
  }, []);

  return ready ? (
    <>
      <LazyAiStageActions />
      <LazyAiAssistant />
    </>
  ) : null;
}
