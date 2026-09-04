"use client";

import { deleteAssignmentProject, listAssignmentProjects, projectKey } from "./assignments";
import { deleteProjectChat, listProjectChats } from "./chats";
import { idbDelete, idbGetAll, idbPut } from "./db";
import { deleteLocalFile, listLocalFiles, readLocalFile, saveLocalFile, type LocalFileMeta } from "./files";
import { listLocalCalendars } from "./calendar";

type BackupFile = Omit<LocalFileMeta, "key" | "ownerId" | "blob" | "localPath" | "storage"> & {
  dataUrl: string | null;
};

type LocalBackupPayload = {
  app: "수행평가 도우미";
  format: "teston-local-backup";
  version: 1;
  exportedAt: string;
  assignments: Array<Record<string, unknown>>;
  chats: Array<Record<string, unknown>>;
  calendars: Array<Record<string, unknown>>;
  files: BackupFile[];
};

export async function buildLocalBackup(ownerId: string): Promise<Blob> {
  const [assignments, chats, calendars, files] = await Promise.all([
    listAssignmentProjects(ownerId),
    listProjectChats(ownerId),
    listLocalCalendars(ownerId),
    listLocalFiles(ownerId),
  ]);
  const backupFiles: BackupFile[] = [];
  for (const meta of files) {
    const blob = await readLocalFile(meta);
    backupFiles.push({
      id: meta.id,
      assignmentId: meta.assignmentId,
      name: meta.name,
      mimeType: meta.mimeType,
      size: meta.size,
      createdAt: meta.createdAt,
      dataUrl: blob ? await blobToDataUrl(blob) : null,
    });
  }
  const stripOwner = <T extends Record<string, unknown>>(row: T) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== "ownerId" && key !== "key"));
  const payload: LocalBackupPayload = {
    app: "수행평가 도우미",
    format: "teston-local-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    assignments: assignments.map((row) => stripOwner(row as unknown as Record<string, unknown>)),
    chats: chats.map((row) => stripOwner(row as unknown as Record<string, unknown>)),
    calendars: calendars.map((row) => stripOwner(row as unknown as Record<string, unknown>)),
    files: backupFiles,
  };
  return new Blob([JSON.stringify(payload)], { type: "application/json" });
}

export async function restoreLocalBackup(ownerId: string, file: File) {
  if (file.size > 250 * 1024 * 1024) throw new Error("BACKUP_TOO_LARGE");
  const payload = JSON.parse(await file.text()) as Partial<LocalBackupPayload>;
  if (payload.format !== "teston-local-backup" || payload.version !== 1) throw new Error("INVALID_BACKUP");
  if (!Array.isArray(payload.assignments) || !Array.isArray(payload.chats) || !Array.isArray(payload.calendars) || !Array.isArray(payload.files)) {
    throw new Error("INVALID_BACKUP");
  }

  for (const value of payload.assignments) {
    const id = typeof value.id === "string" ? value.id : crypto.randomUUID();
    await idbPut("assignments", {
      ...value,
      id,
      key: projectKey(ownerId, id),
      ownerId,
      updatedAt: Date.now(),
    });
  }
  for (const value of payload.chats) {
    const assignmentId = typeof value.assignmentId === "string" ? value.assignmentId : "restored";
    await idbPut("chats", { ...value, key: `${ownerId}:${assignmentId}`, ownerId, assignmentId, updatedAt: Date.now() });
  }
  for (const value of payload.calendars) {
    await idbPut("calendar", { ...value, key: `calendar:${ownerId}`, ownerId, updatedAt: Date.now() });
  }
  for (const item of payload.files) {
    if (!item || typeof item.assignmentId !== "string" || typeof item.name !== "string" || !item.dataUrl) continue;
    const blob = dataUrlToBlob(item.dataUrl, item.mimeType || "application/octet-stream");
    await saveLocalFile(ownerId, item.assignmentId, new File([blob], item.name, { type: item.mimeType || blob.type }));
  }
}

export async function deleteAllLocalDataForOwner(ownerId: string) {
  const [assignments, chats, calendars, files] = await Promise.all([
    listAssignmentProjects(ownerId),
    listProjectChats(ownerId),
    listLocalCalendars(ownerId),
    listLocalFiles(ownerId),
  ]);
  await Promise.all(assignments.map((row) => deleteAssignmentProject(ownerId, row.id)));
  await Promise.all(chats.map((row) => deleteProjectChat(ownerId, row.assignmentId)));
  await Promise.all(calendars.map((row) => idbDelete("calendar", row.key)));
  await Promise.all(files.map((row) => deleteLocalFile(row)));
  const metaRows = await idbGetAll<{ key: string; ownerId?: string }>("meta");
  await Promise.all(metaRows.filter((row) => row.ownerId === ownerId).map((row) => idbDelete("meta", row.key)));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("FILE_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(value: string, fallbackType: string) {
  const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(value);
  if (!match) throw new Error("INVALID_FILE_DATA");
  const mime = match[1] || fallbackType;
  const body = match[3] ?? "";
  const bytes = match[2]
    ? Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(body));
  return new Blob([bytes], { type: mime });
}
