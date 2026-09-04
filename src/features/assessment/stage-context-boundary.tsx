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
      if (stored !== current) {
        removeSession(assessmentResearchStorageKey);
        removeSession(assessmentResearchSourceNotesStorageKey);
        removeSession(assessmentExecutionPlanStorageKey);
        removeSession(assessmentDraftStorageKey);
        removeSession(assessmentVerificationStorageKey);
        writeSession(assessmentStageContextStorageKey, current);
      }
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
