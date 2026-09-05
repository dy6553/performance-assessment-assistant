"use client";

import { idbDelete, idbGetAll, idbPut } from "./db";
import { getCurrentProjectId } from "./assignments";
import { getConfiguredOwnerId } from "./owner";
import { checkStorageCapacity } from "./capacity";

export type LocalFileMeta = {
  key: string;
  id: string;
  ownerId: string;
  assignmentId: string;
  name: string;
  mimeType: string;
  size: number;
  localPath: string;
  storage: "opfs" | "indexeddb";
  blob?: Blob;
  createdAt: number;
};

type StorageManagerWithDirectory = StorageManager & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

export async function saveCurrentProjectFile(file: File): Promise<LocalFileMeta | null> {
  const ownerId = getConfiguredOwnerId();
  const assignmentId = getCurrentProjectId(true);
  if (!ownerId || !assignmentId) return null;
  return saveLocalFile(ownerId, assignmentId, file);
}

export async function saveLocalFile(ownerId: string, assignmentId: string, file: File): Promise<LocalFileMeta> {
  await checkStorageCapacity(file.size);
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^0-9A-Za-z가-힣._-]+/g, "_").slice(0, 140) || "upload";
  const key = `${ownerId}:${assignmentId}:${id}`;
  const createdAt = Date.now();
  const storageManager = navigator.storage as StorageManagerWithDirectory;

  if (storageManager?.getDirectory) {
    try {
      const root = await storageManager.getDirectory();
      const assignments = await root.getDirectoryHandle("assignments", { create: true });
      const owner = await assignments.getDirectoryHandle(ownerId, { create: true });
      const project = await owner.getDirectoryHandle(assignmentId, { create: true });
      const fileName = `${id}-${safeName}`;
      const handle = await project.getFileHandle(fileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      const meta: LocalFileMeta = {
        key,
        id,
        ownerId,
        assignmentId,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        localPath: `/assignments/${ownerId}/${assignmentId}/${fileName}`,
        storage: "opfs",
        createdAt,
      };
      await idbPut("files", meta);
      return meta;
    } catch {
      // Fall through to IndexedDB Blob storage when OPFS is unavailable or denied.
    }
  }

  const meta: LocalFileMeta = {
    key,
    id,
    ownerId,
    assignmentId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    localPath: `indexeddb://${key}`,
    storage: "indexeddb",
    blob: file,
    createdAt,
  };
  await idbPut("files", meta);
  return meta;
}

export async function listLocalFiles(ownerId: string, assignmentId?: string) {
  const rows = await idbGetAll<LocalFileMeta>("files");
  return rows.filter((row) => row.ownerId === ownerId && (!assignmentId || row.assignmentId === assignmentId));
}

export async function readLocalFile(meta: LocalFileMeta): Promise<Blob | null> {
  if (meta.storage === "indexeddb") return meta.blob ?? null;
  try {
    const storageManager = navigator.storage as StorageManagerWithDirectory;
    const root = await storageManager.getDirectory?.();
    if (!root) return null;
    const parts = meta.localPath.split("/").filter(Boolean);
    let directory: FileSystemDirectoryHandle = root;
    for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
    const handle = await directory.getFileHandle(parts.at(-1)!);
    return await handle.getFile();
  } catch {
    return null;
  }
}

export async function deleteLocalFile(meta: LocalFileMeta) {
  if (meta.storage === "opfs") {
    try {
      const storageManager = navigator.storage as StorageManagerWithDirectory;
      const root = await storageManager.getDirectory?.();
      if (root) {
        const parts = meta.localPath.split("/").filter(Boolean);
        let directory: FileSystemDirectoryHandle = root;
        for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part);
        await directory.removeEntry(parts.at(-1)!);
      }
    } catch {
      // Metadata deletion still prevents the file from being surfaced by the app.
    }
  }
  await idbDelete("files", meta.key);
}

export async function deleteProjectFiles(ownerId: string, assignmentId: string) {
  const files = await listLocalFiles(ownerId, assignmentId);
  await Promise.all(files.map((file) => deleteLocalFile(file)));
}
