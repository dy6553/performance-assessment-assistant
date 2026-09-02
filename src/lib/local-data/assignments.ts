"use client";

import { idbDelete, idbGet, idbGetAll, idbPut } from "./db";

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
  return row?.ownerId === ownerId ? row : null;
}

export async function saveAssignmentProject(
  ownerId: string,
  projectId: string,
  value: Omit<AssignmentProject, "key" | "id" | "ownerId" | "createdAt" | "updatedAt">,
) {
  const key = projectKey(ownerId, projectId);
  const previous = await idbGet<AssignmentProject>("assignments", key);
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
  return rows.filter((row) => row.ownerId === ownerId).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteAssignmentProject(ownerId: string, projectId: string) {
  await idbDelete("assignments", projectKey(ownerId, projectId));
}
