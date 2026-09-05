"use client";

const MAGIC = "TESTON-SECURE-BACKUP\n";
const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SecureBackupHeader = {
  app: string;
  format: string;
  version: 1;
  cipher: "AES-256-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
};

export async function encryptSecureBackup(
  plaintext: ArrayBuffer,
  password: string,
  options: { app: string; format: string },
): Promise<Blob> {
  validatePassword(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const header: SecureBackupHeader = {
    app: options.app,
    format: options.format,
    version: 1,
    cipher: "AES-256-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
  };
  const additionalData = encoder.encode(aadFor(header));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    key,
    plaintext,
  );
  const headerBytes = encoder.encode(JSON.stringify(header));
  const headerLength = new Uint8Array(4);
  new DataView(headerLength.buffer).setUint32(0, headerBytes.byteLength, false);
  return new Blob([encoder.encode(MAGIC), headerLength, headerBytes, ciphertext], {
    type: "application/octet-stream",
  });
}

export async function decryptSecureBackup(
  file: Blob,
  password: string,
  options: { app: string; format: string },
): Promise<ArrayBuffer> {
  validatePassword(password);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const magic = encoder.encode(MAGIC);
  if (bytes.byteLength < magic.byteLength + 4 || !startsWith(bytes, magic)) {
    throw new Error("INVALID_SECURE_BACKUP");
  }
  const headerLength = new DataView(
    bytes.buffer,
    bytes.byteOffset + magic.byteLength,
    4,
  ).getUint32(0, false);
  const headerStart = magic.byteLength + 4;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerEnd >= bytes.byteLength) {
    throw new Error("INVALID_SECURE_BACKUP");
  }
  const header = JSON.parse(decoder.decode(bytes.subarray(headerStart, headerEnd))) as Partial<SecureBackupHeader>;
  if (
    header.app !== options.app ||
    header.format !== options.format ||
    header.version !== 1 ||
    header.cipher !== "AES-256-GCM" ||
    header.kdf !== "PBKDF2-SHA-256" ||
    typeof header.iterations !== "number" ||
    header.iterations < 100_000 ||
    typeof header.salt !== "string" ||
    typeof header.iv !== "string"
  ) {
    throw new Error("INVALID_SECURE_BACKUP");
  }
  const salt = base64ToBytes(header.salt);
  const iv = base64ToBytes(header.iv);
  if (salt.byteLength !== 16 || iv.byteLength !== 12) throw new Error("INVALID_SECURE_BACKUP");
  const key = await deriveKey(password, salt, header.iterations);
  const additionalData = encoder.encode(aadFor(header as SecureBackupHeader));
  const ciphertext = bytes.slice(headerEnd).buffer;
  try {
    return await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData },
      key,
      ciphertext,
    );
  } catch {
    throw new Error("BACKUP_PASSWORD_OR_INTEGRITY_FAILED");
  }
}

export async function isSecureBackup(file: Blob) {
  const magic = encoder.encode(MAGIC);
  const head = new Uint8Array(await file.slice(0, magic.byteLength).arrayBuffer());
  return startsWith(head, magic);
}

export async function sha256Hex(value: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validatePassword(password: string) {
  if (password.length < 10) throw new Error("BACKUP_PASSWORD_TOO_SHORT");
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function aadFor(header: SecureBackupHeader) {
  return `${header.app}|${header.format}|${header.version}|${header.cipher}|${header.kdf}|${header.iterations}`;
}

function startsWith(value: Uint8Array, prefix: Uint8Array) {
  if (value.byteLength < prefix.byteLength) return false;
  for (let index = 0; index < prefix.byteLength; index += 1) {
    if (value[index] !== prefix[index]) return false;
  }
  return true;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
