"use client";

import { idbDelete, idbGet, idbGetAll, idbPut } from "./db";
import { checkStorageCapacity } from "./capacity";

const CURRENT_PROJECT_KEY = "assessment-local-current-project-v1";

export type AssignmentProject = {
  key: string;
  id: string;
  ownerId: string;
  title?: string;
  subject?: string;
  assignmentType?: string;
  stage: "setup" | "topic" | "research" | "plan" | "draft" | "final";
  assignment?: unknown;
  analysis?: unknown;
  draft?: unknown;
  verification?: unknown;
  final?: unknown;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export function projectKey(ownerId: string, projectId: string) {
  return `${ownerId}:${projectId}`;
}

export function getCurrentProjectId(create = true): string | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(CURRENT_PROJECT_KEY)?.trim();
  if (current) return current;
  if (!create) return null;
  const id = crypto.randomUUID();
  window.localStorage.setItem(CURRENT_PROJECT_KEY, id);
  return id;
}

export function setCurrentProjectId(projectId: string) {
  window.localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
}

export function createFreshProjectId() {
  const id = crypto.randomUUID();
  setCurrentProjectId(id);
  return id;
}

export async function loadAssignmentProject(ownerId: string, projectId: string) {
  const row = await idbGet<AssignmentProject>("assignments", projectKey(ownerId, projectId));
  return row?.ownerId === ownerId && !row.deletedAt ? row : null;
}

export async function saveAssignmentProject(
  ownerId: string,
  projectId: string,
  value: Omit<AssignmentProject, "key" | "id" | "ownerId" | "createdAt" | "updatedAt">,
) {
  const key = projectKey(ownerId, projectId);
  const previous = await idbGet<AssignmentProject>("assignments", key);
  if (previous?.deletedAt) throw new Error("휴지통의 문서는 복원 후 수정해 주세요.");
  await checkStorageCapacity(Math.max(0, new Blob([JSON.stringify(value)]).size - new Blob([JSON.stringify(previous ?? {})]).size));
  const now = Date.now();
  const row: AssignmentProject = {
    key,
    id: projectId,
    ownerId,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    ...value,
  };
  await idbPut("assignments", row);
  return row;
}

export async function listAssignmentProjects(ownerId: string) {
  const rows = await idbGetAll<AssignmentProject>("assignments");
  return rows.filter((row) => row.ownerId === ownerId && !row.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteAssignmentProject(ownerId: string, projectId: string) {
  const row = await loadAssignmentProject(ownerId, projectId);
  if (row) await idbPut("assignments", { ...row, deletedAt: Date.now() });
}

export async function listAssignmentTrash(ownerId: string) {
  const rows = await idbGetAll<AssignmentProject>("assignments");
  return rows.filter(row => row.ownerId === ownerId && row.deletedAt).sort((a, b) => b.deletedAt! - a.deletedAt!);
}

export async function purgeExpiredAssignmentTrash(ownerId: string) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const expired = (await listAssignmentTrash(ownerId)).filter(row => row.deletedAt! <= cutoff);
  await Promise.all(expired.map(row => idbDelete("assignments", row.key)));
  return expired.map(row => row.id);
}

export async function restoreAssignment(ownerId: string, id: string) {
  const row = await idbGet<AssignmentProject>("assignments", projectKey(ownerId, id));
  if (!row || row.ownerId !== ownerId || !row.deletedAt) return;
  if (row.deletedAt <= Date.now() - 7 * 86400000) throw new Error("복원 기간이 지났습니다.");
  await idbPut("assignments", { ...row, deletedAt: undefined });
}
