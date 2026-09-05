"use client";

export const LOCAL_DB_NAME = "assessment-helper-local-v1";
export const LOCAL_DB_VERSION = 1;

export type StoreName = "assignments" | "chats" | "calendar" | "files" | "meta";

let openPromise: Promise<IDBDatabase> | null = null;

export function openLocalDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("INDEXED_DB_UNAVAILABLE"));
  if (openPromise) return openPromise;
  openPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ["assignments", "chats", "calendar", "files", "meta"] as const) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { openPromise = null; reject(request.error ?? new Error("INDEXED_DB_OPEN_FAILED")); };
    request.onblocked = () => { openPromise = null; reject(new Error("INDEXED_DB_BLOCKED")); };
  });
  return openPromise;
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | null> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readonly");
    const request = transaction.objectStore(store).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_READ_FAILED"));
  });
}

export async function idbPut<T extends { key: string }>(store: StoreName, value: T): Promise<void> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("INDEXED_DB_WRITE_FAILED"));
    transaction.onabort = () => reject(transaction.error ?? new Error("INDEXED_DB_WRITE_ABORTED"));
  });
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("INDEXED_DB_DELETE_FAILED"));
  });
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readonly");
    const request = transaction.objectStore(store).getAll();
    request.onsuccess = () => resolve((request.result as T[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_LIST_FAILED"));
  });
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("INDEXED_DB_CLEAR_FAILED"));
  });
}
