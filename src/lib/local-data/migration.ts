"use client";

import {
  DEFAULT_CURRICULUM_KEY,
  DEFAULT_GRADE_KEY,
  DEFAULT_SCHOOL_LEVEL_KEY,
  DEFAULT_SUBJECT_KEY,
} from "@/lib/client-preferences";

import { getCurrentProjectId, loadAssignmentProject, setCurrentProjectId } from "./assignments";
import { readProjectChat } from "./chats";
import { LOCAL_PROJECT_KEYS, persistCurrentProject } from "./compat";
import { idbGet, idbPut } from "./db";
import { readLocalCalendar, saveLocalCalendar } from "./calendar";

const MIGRATION_VERSION = 1;
const LEGACY_CALENDAR_KEY = "assessment-calendar-events-v1";
const LEGACY_NOTIFIED_KEY = "assessment-calendar-notified-v1";

export async function hydrateAndMigrateLocalData(ownerId: string) {
  if (!ownerId) return;
  await requestPersistentStorage();

  const projectId = getCurrentProjectId(true)!;
  const existing = await loadAssignmentProject(ownerId, projectId);
  if (existing) {
    hydrateProjectCache(existing);
    const chat = await readProjectChat(ownerId, projectId);
    if (chat.length) window.sessionStorage.setItem(LOCAL_PROJECT_KEYS.chat, JSON.stringify(chat));
  } else if (hasLegacyProjectData()) {
    await persistCurrentProject();
    const verified = await loadAssignmentProject(ownerId, projectId);
    if (verified) await markMigration(ownerId, "legacy-project", MIGRATION_VERSION);
  }

  await migrateCalendar(ownerId);
  await syncSharedPersonalization();
}

export async function startFreshLocalProject() {
  const id = crypto.randomUUID();
  setCurrentProjectId(id);
  Object.values(LOCAL_PROJECT_KEYS).forEach((key) => window.sessionStorage.removeItem(key));
  return id;
}

async function migrateCalendar(ownerId: string) {
  const existing = await readLocalCalendar(ownerId);
  if (existing) {
    window.localStorage.setItem(LEGACY_CALENDAR_KEY, JSON.stringify(existing.events));
    window.localStorage.setItem(LEGACY_NOTIFIED_KEY, JSON.stringify(existing.notified));
    return;
  }
  const events = parseArray(window.localStorage.getItem(LEGACY_CALENDAR_KEY));
  const notified = parseRecord(window.localStorage.getItem(LEGACY_NOTIFIED_KEY));
  if (!events.length && !Object.keys(notified).length) return;
  await saveLocalCalendar(ownerId, events, notified);
  const verified = await readLocalCalendar(ownerId);
  if (verified) await markMigration(ownerId, "legacy-calendar", MIGRATION_VERSION);
}

function hydrateProjectCache(project: Awaited<ReturnType<typeof loadAssignmentProject>>) {
  if (!project) return;
  const pairs: Array<[string, unknown]> = [
    [LOCAL_PROJECT_KEYS.assignment, project.assignment],
    [LOCAL_PROJECT_KEYS.analysis, project.analysis],
    [LOCAL_PROJECT_KEYS.draft, project.draft],
    [LOCAL_PROJECT_KEYS.verification, project.verification],
    [LOCAL_PROJECT_KEYS.finalSignature, (project.final as { initializedSignature?: string } | undefined)?.initializedSignature],
  ];
  for (const [key, value] of pairs) {
    if (value === undefined || value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  }
}

function hasLegacyProjectData() {
  return Object.values(LOCAL_PROJECT_KEYS).some((key) => window.sessionStorage.getItem(key) !== null);
}

async function syncSharedPersonalization() {
  try {
    const response = await fetch("/api/personalization/shared", { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      profile?: {
        schoolLevel?: string | null;
        grade?: number | null;
        curriculum?: string | null;
        responseDetailLevel?: string;
        explanationStyle?: string;
        personalizationEnabled?: boolean;
      } | null;
    };
    const profile = payload.profile;
    if (!profile?.personalizationEnabled) return;
    if (profile.schoolLevel === "초등학교" || profile.schoolLevel === "중학교" || profile.schoolLevel === "고등학교") {
      window.localStorage.setItem(DEFAULT_SCHOOL_LEVEL_KEY, profile.schoolLevel);
    }
    if (typeof profile.grade === "number" && Number.isInteger(profile.grade)) {
      window.localStorage.setItem(DEFAULT_GRADE_KEY, String(profile.grade));
    }
    if (profile.curriculum === "2015 개정 교육과정" || profile.curriculum === "2022 개정 교육과정") {
      window.localStorage.setItem(DEFAULT_CURRICULUM_KEY, profile.curriculum);
    }
    if (profile.responseDetailLevel) window.localStorage.setItem("assessment-shared-detail-level", profile.responseDetailLevel);
    if (profile.explanationStyle) window.localStorage.setItem("assessment-shared-explanation-style", profile.explanationStyle);

    // Subject defaults are intentionally removed. Every assignment must receive its subject from the current user input.
    window.localStorage.removeItem(DEFAULT_SUBJECT_KEY);
    window.dispatchEvent(new CustomEvent("assessment-shared-personalization-updated"));
  } catch {
    // Keep the app usable offline. The last explicit local defaults remain available.
  }
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Persistence is best-effort; IndexedDB remains the durable fallback.
  }
}

async function markMigration(ownerId: string, kind: string, version: number) {
  await idbPut("meta", { key: `migration:${ownerId}:${kind}`, ownerId, version, completedAt: Date.now() });
}

export async function readMigrationVersion(ownerId: string, kind: string) {
  const row = await idbGet<{ key: string; version: number }>("meta", `migration:${ownerId}:${kind}`);
  return row?.version ?? 0;
}

function parseArray(raw: string | null): unknown[] {
  try {
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function parseRecord(raw: string | null): Record<string, number> {
  try {
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, number>) : {};
  } catch {
    return {};
  }
}
