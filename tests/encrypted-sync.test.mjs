import assert from "node:assert/strict";
import { test } from "node:test";
import { webcrypto } from "node:crypto";

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= (value) => Buffer.from(value, "binary").toString("base64");
globalThis.atob ??= (value) => Buffer.from(value, "base64").toString("binary");

const cryptoModule = await import("../src/lib/sync/crypto.ts");

test("AES-256-GCM round trip and unique IV", async () => {
  const key = await cryptoModule.generateSyncKey();
  const first = await cryptoModule.encryptJson(key, { draft: "민감한 초안" }, "draft:1|1|1");
  const second = await cryptoModule.encryptJson(key, { draft: "민감한 초안" }, "draft:1|1|1");
  assert.notEqual(first.payloadIv, second.payloadIv);
  assert.deepEqual(await cryptoModule.decryptJson(key, first.encryptedPayload, first.payloadIv, "draft:1|1|1"), { draft: "민감한 초안" });
});

test("AES-256-GCM rejects tampered ciphertext", async () => {
  const key = await cryptoModule.generateSyncKey();
  const value = await cryptoModule.encryptJson(key, { answer: 42 }, "answer:1|1|1");
  const bytes = cryptoModule.base64ToBytes(value.encryptedPayload);
  bytes[0] ^= 1;
  await assert.rejects(() => cryptoModule.decryptJson(key, cryptoModule.bytesToBase64(bytes), value.payloadIv, "answer:1|1|1"));
});

test("device RSA-OAEP envelope transfers the account sync key", async () => {
  const syncKey = await cryptoModule.generateSyncKey();
  const device = await cryptoModule.generateDeviceKeyPair();
  const wrapped = await cryptoModule.wrapSyncKey(syncKey, device.publicKey);
  const restored = await cryptoModule.unwrapSyncKey(wrapped, device.privateKey);
  const encrypted = await cryptoModule.encryptJson(syncKey, { ok: true }, "key-test");
  assert.deepEqual(await cryptoModule.decryptJson(restored, encrypted.encryptedPayload, encrypted.payloadIv, "key-test"), { ok: true });
});
