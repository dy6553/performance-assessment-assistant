"use client";

import { getCurrentProjectId, saveAssignmentProject } from "./assignments";
import { saveProjectChat, type LocalChatMessage } from "./chats";
import { getConfiguredOwnerId } from "./owner";

export const LOCAL_PROJECT_KEYS = {
  assignment: "assessment-wizard-draft-v1",
  analysis: "assessment-wizard-analysis-v1",
  draft: "assessment-wizard-generated-draft-v1",
  verification: "assessment-wizard-verification-v1",
  finalSignature: "assessment-final-initialized-v1",
  chat: "assessment-ai-chat-v1",
} as const;

let persistTimer: number | null = null;

export function readProjectCache<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeProjectCache(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } finally {
    scheduleLocalProjectSave();
  }
}

export function removeProjectCache(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } finally {
    scheduleLocalProjectSave();
  }
}

export function clearProjectCache() {
  Object.values(LOCAL_PROJECT_KEYS).forEach((key) => window.sessionStorage.removeItem(key));
  scheduleLocalProjectSave();
}

export function scheduleLocalProjectSave() {
  if (persistTimer !== null) window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    void persistCurrentProject();
  }, 400);
  window.dispatchEvent(new CustomEvent("assessment-local-save-state", { detail: { state: "saving" } }));
}

export async function persistCurrentProject() {
  const ownerId = getConfiguredOwnerId();
  const projectId = getCurrentProjectId(true);
  if (!ownerId || !projectId) return;

  const assignment = readProjectCache<Record<string, unknown>>(LOCAL_PROJECT_KEYS.assignment);
  const analysis = readProjectCache<unknown>(LOCAL_PROJECT_KEYS.analysis);
  const draft = readProjectCache<unknown>(LOCAL_PROJECT_KEYS.draft);
  const verification = readProjectCache<unknown>(LOCAL_PROJECT_KEYS.verification);
  const finalSignature = readProjectCache<string>(LOCAL_PROJECT_KEYS.finalSignature);
  const chat = readProjectCache<LocalChatMessage[]>(LOCAL_PROJECT_KEYS.chat) ?? [];
  const stage = finalSignature ? "final" : draft ? "draft" : assignment?.topic ? "topic" : "setup";

  await Promise.all([
    saveAssignmentProject(ownerId, projectId, {
      stage,
      assignment,
      analysis,
      draft,
      verification,
      final: finalSignature ? { initializedSignature: finalSignature } : undefined,
      title: typeof assignment?.topic === "string" ? assignment.topic : undefined,
      subject: typeof assignment?.subject === "string" ? assignment.subject : undefined,
      assignmentType: typeof assignment?.assignmentType === "string" ? assignment.assignmentType : undefined,
    }),
    saveProjectChat(ownerId, projectId, chat),
  ]);

  window.dispatchEvent(new CustomEvent("assessment-local-save-state", { detail: { state: "saved", savedAt: Date.now() } }));
}
