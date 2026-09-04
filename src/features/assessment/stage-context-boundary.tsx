"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  assessmentDraftStorageKey,
  assessmentFlowStorageKey,
  assessmentVerificationStorageKey,
} from "./assessment-flow";
import {
  assessmentExecutionPlanStorageKey,
  assessmentResearchSourceNotesStorageKey,
  assessmentResearchStorageKey,
  assessmentStageContextId,
  assessmentStageContextStorageKey,
} from "./stage-flow";
import type { AssignmentInput } from "./schemas";

export function StageContextBoundary({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const assignment = readSession<AssignmentInput>(assessmentFlowStorageKey);
      if (!assignment) {
        setReady(true);
        return;
      }
      const current = assessmentStageContextId(assignment);
      const stored = readSession<string>(assessmentStageContextStorageKey);

      // 첫 배포/마이그레이션에서는 기존 초안과 검증 결과를 보존하고 현재 과제의 기준값만 기록합니다.
      // 이후 실제로 다른 과제로 바뀐 경우에만 새 단계 결과와 하위 산출물을 초기화합니다.
      if (stored !== null && stored !== current) {
        removeSession(assessmentResearchStorageKey);
        removeSession(assessmentResearchSourceNotesStorageKey);
        removeSession(assessmentExecutionPlanStorageKey);
        removeSession(assessmentDraftStorageKey);
        removeSession(assessmentVerificationStorageKey);
      }
      if (stored !== current) writeSession(assessmentStageContextStorageKey, current);
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!ready) return null;
  return children;
}

function readSession<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function writeSession(key: string, value: unknown) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Ignore restricted storage. */ }
}

function removeSession(key: string) {
  try { window.sessionStorage.removeItem(key); } catch { /* Ignore restricted storage. */ }
}
