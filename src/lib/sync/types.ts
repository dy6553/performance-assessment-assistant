export type SyncStatus = "idle" | "syncing" | "offline" | "failed" | "conflict" | "needs-key";

export type SyncRecord = {
  recordId: string;
  recordType: string;
  version: number;
  baseVersion: number;
  sourceDeviceId: string;
  updatedAt: string;
  deletedAt: string | null;
  encryptedPayload: string;
  payloadIv: string;
  payloadSchemaVersion: number;
  contentHash: string;
};

export type SyncQueueItem = SyncRecord & { key: string; attempts: number; nextAttemptAt: number };

export type DeviceInfo = {
  deviceId: string;
  deviceName: string;
  platform: string;
  createdAt: string;
  lastSeenAt: string;
  lastSyncAt: string | null;
  revokedAt: string | null;
  publicKey: string | null;
  hasKeyEnvelope: boolean;
};

export type ConflictRow = {
  key: string;
  recordId: string;
  recordType: string;
  local: SyncQueueItem;
  remote: SyncRecord;
  detectedAt: string;
};
