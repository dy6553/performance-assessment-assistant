"use client";

import { idbDelete, idbGet, idbGetAll, idbPut, type StoreName } from "@/lib/local-data/db";
import {
  decryptBytes,
  decryptJson,
  encryptBytes,
  encryptJson,
  exportPublicKey,
  generateDeviceKeyPair,
  generateSyncKey,
  importPublicKey,
  sha256,
  unwrapSyncKey,
  wrapSyncKey,
} from "./crypto";
import { readLocalFile, restoreLocalFile, type LocalFileMeta } from "@/lib/local-data/files";
import type { ConflictRow, DeviceInfo, SyncQueueItem, SyncRecord, SyncStatus } from "./types";

const DEVICE_KEY = "device";
const KEY_PAIR_KEY = "device-key-pair";
const SYNC_KEY_KEY = "account-sync-key";
const CURSOR_KEY = "pull-cursor";
const SYNCABLE = new Set<StoreName>(["assignments", "chats", "calendar", "files", "meta"]);

type CryptoRow = { key: string; value: CryptoKey | CryptoKeyPair | string };
type StateRow = { key: string; value: string | number };
type DeviceRow = { key: string; deviceId: string; deviceName: string; platform: string };
type FileSyncRow = { fileId: string; recordId: string; version: number; storagePath: string; fileIv: string; contentHash: string; byteSize: number; mimeType: string; deletedAt: string | null };

function emit(status: SyncStatus, detail?: string, lastSyncAt?: string) {
  window.dispatchEvent(new CustomEvent("assessment-sync-state", { detail: { status, detail, lastSyncAt } }));
}

async function api<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action, ...body }),
  });
  const value = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(value.error || `SYNC_HTTP_${response.status}`);
  return value;
}

function platformName() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "iOS/iPadOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "macOS";
  return "Web";
}

async function ensureDevice() {
  let device = await idbGet<DeviceRow>("syncCrypto", DEVICE_KEY);
  let pair = await idbGet<CryptoRow>("syncCrypto", KEY_PAIR_KEY);
  if (!device) {
    const platform = platformName();
    device = {
      key: DEVICE_KEY,
      deviceId: crypto.randomUUID(),
      deviceName: `${platform} · ${navigator.userAgent.includes("Mobile") ? "휴대폰" : "브라우저"}`,
      platform,
    };
    await idbPut("syncCrypto", device);
  }
  if (!pair || !(pair.value as CryptoKeyPair).privateKey) {
    pair = { key: KEY_PAIR_KEY, value: await generateDeviceKeyPair() };
    await idbPut("syncCrypto", pair);
  }
  const keyPair = pair.value as CryptoKeyPair;
  await api("register", {
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    publicKey: await exportPublicKey(keyPair.publicKey),
  });
  return { device, keyPair };
}

async function ensureSyncKey(deviceId: string, keyPair: CryptoKeyPair) {
  const local = await idbGet<CryptoRow>("syncCrypto", SYNC_KEY_KEY);
  if (local?.value instanceof CryptoKey) return local.value;
  const envelope = await api<{ wrappedKey: string | null; deviceCount: number }>("key-envelope", { deviceId });
  if (envelope.wrappedKey) {
    const key = await unwrapSyncKey(envelope.wrappedKey, keyPair.privateKey);
    await idbPut("syncCrypto", { key: SYNC_KEY_KEY, value: key });
    return key;
  }
  if (envelope.deviceCount <= 1) {
    const key = await generateSyncKey();
    await idbPut("syncCrypto", { key: SYNC_KEY_KEY, value: key });
    await api("put-key-envelope", {
      deviceId,
      wrappedKey: await wrapSyncKey(key, keyPair.publicKey),
    });
    return key;
  }
  emit("needs-key", "기존 기기에서 암호화 키 전달을 기다리는 중입니다.");
  return null;
}

async function shareKeyWithPendingDevices(deviceId: string, key: CryptoKey) {
  const response = await api<{ devices: DeviceInfo[] }>("devices", { deviceId });
  for (const target of response.devices) {
    if (target.revokedAt || target.hasKeyEnvelope || !target.publicKey) continue;
    const publicKey = await importPublicKey(target.publicKey);
    await api("put-key-envelope", {
      deviceId,
      targetDeviceId: target.deviceId,
      wrappedKey: await wrapSyncKey(key, publicKey),
    });
  }
}

async function queueRecord(store: StoreName, localKey: string, deleted = false) {
  if (!SYNCABLE.has(store)) return;
  const { device, keyPair } = await ensureDevice();
  const syncKey = await ensureSyncKey(device.deviceId, keyPair);
  if (!syncKey) return;
  const recordId = `${store}:${localKey}`;
  const state = await idbGet<StateRow>("syncState", recordId);
  const baseVersion = Number(state?.value ?? 0);
  const payload = deleted ? null : await idbGet<Record<string, unknown>>(store, localKey);
  const contentHash = await sha256(JSON.stringify(payload));
  const aad = `${recordId}|${baseVersion + 1}|1`;
  const encrypted = await encryptJson(syncKey, payload, aad);
  const row: SyncQueueItem = {
    key: recordId,
    recordId,
    recordType: store,
    version: baseVersion + 1,
    baseVersion,
    sourceDeviceId: device.deviceId,
    updatedAt: new Date().toISOString(),
    deletedAt: deleted ? new Date().toISOString() : null,
    encryptedPayload: encrypted.encryptedPayload,
    payloadIv: encrypted.payloadIv,
    payloadSchemaVersion: 1,
    contentHash,
    attempts: 0,
    nextAttemptAt: Date.now(),
  };
  await idbPut("syncQueue", row);
  scheduleSync();
}

async function pushQueue(deviceId: string) {
  const all = await idbGetAll<SyncQueueItem>("syncQueue");
  const batch = all.filter((item) => item.nextAttemptAt <= Date.now()).slice(0, 50);
  if (!batch.length) return;
  const response = await api<{ accepted: Array<{ recordId: string; version: number }>; conflicts: SyncRecord[] }>("push", {
    deviceId,
    records: batch.map((item) => ({
      recordId: item.recordId, recordType: item.recordType, version: item.version, baseVersion: item.baseVersion,
      sourceDeviceId: item.sourceDeviceId, updatedAt: item.updatedAt, deletedAt: item.deletedAt,
      encryptedPayload: item.encryptedPayload, payloadIv: item.payloadIv,
      payloadSchemaVersion: item.payloadSchemaVersion, contentHash: item.contentHash,
    })),
  });
  for (const accepted of response.accepted) {
    await idbPut("syncState", { key: accepted.recordId, value: accepted.version });
    await idbDelete("syncQueue", accepted.recordId);
  }
  if (response.accepted.length) {
    await api("ack", {
      deviceId,
      items: response.accepted.map((item) => ({ itemKind: "record", itemId: item.recordId, version: item.version })),
    });
  }
  for (const remote of response.conflicts) {
    const local = batch.find((item) => item.recordId === remote.recordId);
    if (!local) continue;
    const conflict: ConflictRow = {
      key: remote.recordId,
      recordId: remote.recordId,
      recordType: remote.recordType,
      local,
      remote,
      detectedAt: new Date().toISOString(),
    };
    await idbPut("syncConflicts", conflict);
  }
  if (response.conflicts.length) {
    window.dispatchEvent(new CustomEvent("assessment-sync-conflicts-changed"));
    emit("conflict", `${response.conflicts.length}개의 충돌을 확인해 주세요.`);
  }
}

async function pullRemote(deviceId: string, key: CryptoKey) {
  const cursor = await idbGet<StateRow>("syncState", CURSOR_KEY);
  const response = await api<{ records: SyncRecord[]; cursor: string }>("pull", {
    deviceId,
    cursor: cursor?.value || "1970-01-01T00:00:00.000Z",
  });
  const acknowledgements: Array<{ itemKind: "record"; itemId: string; version: number }> = [];
  for (const remote of response.records) {
    const queued = await idbGet<SyncQueueItem>("syncQueue", remote.recordId);
    if (queued && queued.baseVersion < remote.version && queued.contentHash !== remote.contentHash) {
      await idbPut("syncConflicts", {
        key: remote.recordId,
        recordId: remote.recordId,
        recordType: remote.recordType,
        local: queued,
        remote,
        detectedAt: new Date().toISOString(),
      } satisfies ConflictRow);
      window.dispatchEvent(new CustomEvent("assessment-sync-conflicts-changed"));
      continue;
    }
    const state = await idbGet<StateRow>("syncState", remote.recordId);
    if (Number(state?.value ?? 0) >= remote.version) {
      acknowledgements.push({ itemKind: "record", itemId: remote.recordId, version: remote.version });
      continue;
    }
    const aad = `${remote.recordId}|${remote.version}|${remote.payloadSchemaVersion}`;
    const payload = await decryptJson<{ key: string } | null>(key, remote.encryptedPayload, remote.payloadIv, aad);
    const [store, ...parts] = remote.recordId.split(":");
    const localKey = parts.join(":");
    if (!SYNCABLE.has(store as StoreName)) continue;
    if (remote.deletedAt) await idbDelete(store as StoreName, localKey);
    else if (payload) await idbPut(store as StoreName, payload);
    await idbPut("syncState", { key: remote.recordId, value: remote.version });
    acknowledgements.push({ itemKind: "record", itemId: remote.recordId, version: remote.version });
  }
  if (acknowledgements.length) await api("ack", { deviceId, items: acknowledgements });
  await idbPut("syncState", { key: CURSOR_KEY, value: response.cursor });
}

async function uploadEncryptedFile(deviceId: string, storagePath: string, ciphertext: ArrayBuffer) {
  const response = await fetch("/api/sync/file", {
    method: "PUT", credentials: "same-origin",
    headers: { "Content-Type": "application/octet-stream", "x-sync-device-id": deviceId, "x-sync-storage-path": storagePath },
    body: ciphertext,
  });
  if (!response.ok) throw new Error((await response.json().catch(() => ({ error: "FILE_UPLOAD_FAILED" }))).error);
}

async function downloadEncryptedFile(deviceId: string, storagePath: string) {
  const query = new URLSearchParams({ deviceId, storagePath });
  const response = await fetch(`/api/sync/file?${query}`, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("FILE_DOWNLOAD_FAILED");
  return response.arrayBuffer();
}

async function syncFiles(deviceId: string, key: CryptoKey) {
  const acknowledgements: Array<{ itemKind: "file"; itemId: string; version: number }> = [];
  const localFiles = await idbGetAll<LocalFileMeta>("files");
  for (const meta of localFiles) {
    const blob = await readLocalFile(meta);
    if (!blob) continue;
    const bytes = await blob.arrayBuffer();
    const contentHash = await sha256(bytes);
    const uploadedHash = await idbGet<StateRow>("syncState", `file-hash:${meta.key}`);
    if (uploadedHash?.value === contentHash) continue;
    const state = await api<{ exists: boolean; version: number; contentHash: string | null }>("file-state", { deviceId, fileId: meta.key });
    if (state.contentHash === contentHash) {
      await idbPut("syncState", { key: `file-hash:${meta.key}`, value: contentHash });
      if (state.version > 0) acknowledgements.push({ itemKind: "file", itemId: meta.key, version: state.version });
      continue;
    }
    const version = Number(state.version || 0) + 1;
    const aad = `file:${meta.key}|${version}`;
    const encrypted = await encryptBytes(key, bytes, aad);
    const prepared = await api<{ storagePath: string }>("file-prepare", { deviceId, fileId: meta.key, version });
    await uploadEncryptedFile(deviceId, prepared.storagePath, encrypted.ciphertext);
    await api("file-commit", {
      deviceId, fileId: meta.key, recordId: `files:${meta.key}`, version, storagePath: prepared.storagePath,
      fileIv: encrypted.iv, contentHash, byteSize: bytes.byteLength, mimeType: meta.mimeType,
    });
    await idbPut("syncState", { key: `file-hash:${meta.key}`, value: contentHash });
    acknowledgements.push({ itemKind: "file", itemId: meta.key, version });
  }

  const remote = await api<{ files: FileSyncRow[] }>("file-list", { deviceId });
  for (const file of remote.files) {
    if (file.deletedAt) continue;
    const known = await idbGet<StateRow>("syncState", `file-hash:${file.fileId}`);
    if (known?.value === file.contentHash) {
      acknowledgements.push({ itemKind: "file", itemId: file.fileId, version: file.version });
      continue;
    }
    const meta = await idbGet<LocalFileMeta>("files", file.fileId);
    if (!meta) continue; // Encrypted metadata record will be pulled before the next retry.
    const ciphertext = await downloadEncryptedFile(deviceId, file.storagePath);
    const plaintext = await decryptBytes(key, ciphertext, file.fileIv, `file:${file.fileId}|${file.version}`);
    await restoreLocalFile({ ...meta, mimeType: file.mimeType, size: file.byteSize }, new Blob([plaintext], { type: file.mimeType }));
    await idbPut("syncState", { key: `file-hash:${file.fileId}`, value: file.contentHash });
    acknowledgements.push({ itemKind: "file", itemId: file.fileId, version: file.version });
  }
  if (acknowledgements.length) await api("ack", { deviceId, items: acknowledgements });
}

let timer: number | null = null;
let running = false;

export function scheduleSync(delay = 1500) {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

export async function syncNow() {
  if (running) return;
  if (!navigator.onLine) { emit("offline"); return; }
  running = true;
  emit("syncing");
  try {
    const { device, keyPair } = await ensureDevice();
    const key = await ensureSyncKey(device.deviceId, keyPair);
    if (!key) return;
    await shareKeyWithPendingDevices(device.deviceId, key);
    await pushQueue(device.deviceId);
    await pullRemote(device.deviceId, key);
    await syncFiles(device.deviceId, key);
    const now = new Date().toISOString();
    await api("touch", { deviceId: device.deviceId, lastSyncAt: now });
    emit("idle", undefined, now);
  } catch (error) {
    emit("failed", error instanceof Error ? error.message : "자동으로 다시 시도합니다.");
  } finally {
    running = false;
  }
}

export async function listDevices() {
  const { device } = await ensureDevice();
  return api<{ devices: DeviceInfo[] }>("devices", { deviceId: device.deviceId });
}

export async function revokeDevice(targetDeviceId: string) {
  const { device } = await ensureDevice();
  await api("revoke", { deviceId: device.deviceId, targetDeviceId });
  return listDevices();
}

export async function listConflicts() {
  return idbGetAll<ConflictRow>("syncConflicts");
}

export async function resolveConflict(recordId: string, choice: "local" | "remote" | "both") {
  const conflict = await idbGet<ConflictRow>("syncConflicts", recordId);
  if (!conflict) return;
  const [store] = recordId.split(":");
  const cryptoRow = await idbGet<CryptoRow>("syncCrypto", SYNC_KEY_KEY);
  const key = cryptoRow?.value instanceof CryptoKey ? cryptoRow.value : null;
  if (!key) throw new Error("SYNC_KEY_MISSING");
  if (choice === "remote" || choice === "both") {
    const aad = `${conflict.remote.recordId}|${conflict.remote.version}|${conflict.remote.payloadSchemaVersion}`;
    const payload = await decryptJson<{ key: string } | null>(key, conflict.remote.encryptedPayload, conflict.remote.payloadIv, aad);
    if (payload) {
      if (choice === "both") payload.key = `${payload.key}-conflict-${Date.now()}`;
      await idbPut(store as StoreName, payload);
    }
  }
  if (choice === "local") {
    conflict.local.baseVersion = conflict.remote.version;
    conflict.local.version = conflict.remote.version + 1;
    await idbPut("syncQueue", conflict.local);
  } else {
    await idbDelete("syncQueue", recordId);
    await idbPut("syncState", { key: recordId, value: conflict.remote.version });
  }
  await idbDelete("syncConflicts", recordId);
  window.dispatchEvent(new CustomEvent("assessment-sync-conflicts-changed"));
  scheduleSync(0);
}

export function installSyncListeners() {
  const onChanged = (event: Event) => {
    const detail = (event as CustomEvent<{ store: StoreName; key: string }>).detail;
    if (detail) void queueRecord(detail.store, detail.key);
  };
  const onDeleted = (event: Event) => {
    const detail = (event as CustomEvent<{ store: StoreName; key: string }>).detail;
    if (detail) void queueRecord(detail.store, detail.key, true);
  };
  const onOnline = () => scheduleSync(0);
  const onVisible = () => { if (document.visibilityState === "visible") scheduleSync(0); };
  window.addEventListener("assessment-local-record-changed", onChanged);
  window.addEventListener("assessment-local-record-deleted", onDeleted);
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  scheduleSync(0);
  const retry = window.setInterval(() => scheduleSync(0), 60_000);
  return () => {
    window.removeEventListener("assessment-local-record-changed", onChanged);
    window.removeEventListener("assessment-local-record-deleted", onDeleted);
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(retry);
  };
}
