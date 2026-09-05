"use client";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function bytesToBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256(value: string | ArrayBuffer) {
  const input = typeof value === "string" ? encoder.encode(value) : value;
  return bytesToBase64(await crypto.subtle.digest("SHA-256", input));
}

export async function generateSyncKey() {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function encryptJson(key: CryptoKey, payload: unknown, aad: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(aad), tagLength: 128 },
    key,
    plaintext,
  );
  return { encryptedPayload: bytesToBase64(ciphertext), payloadIv: bytesToBase64(iv) };
}

export async function decryptJson<T>(
  key: CryptoKey,
  encryptedPayload: string,
  payloadIv: string,
  aad: string,
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64ToBytes(payloadIv),
      additionalData: encoder.encode(aad),
      tagLength: 128,
    },
    key,
    base64ToBytes(encryptedPayload),
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export async function generateDeviceKeyPair() {
  return crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["wrapKey", "unwrapKey"],
  );
}

export async function exportPublicKey(key: CryptoKey) {
  return bytesToBase64(await crypto.subtle.exportKey("spki", key));
}

export async function importPublicKey(value: string) {
  return crypto.subtle.importKey(
    "spki",
    base64ToBytes(value),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["wrapKey"],
  );
}

export async function wrapSyncKey(syncKey: CryptoKey, publicKey: CryptoKey) {
  return bytesToBase64(await crypto.subtle.wrapKey("raw", syncKey, publicKey, { name: "RSA-OAEP" }));
}

export async function unwrapSyncKey(wrapped: string, privateKey: CryptoKey) {
  return crypto.subtle.unwrapKey(
    "raw",
    base64ToBytes(wrapped),
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}
