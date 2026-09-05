"use client";

const LIMIT_KEY = "assessment-storage-limit-mb";
export function storageLimitMB() {
  const value = Number(localStorage.getItem(LIMIT_KEY) ?? 300);
  return Number.isFinite(value) && value >= 50 && value <= 2000 ? value : 300;
}
export function setStorageLimitMB(value: number) {
  if (!Number.isFinite(value) || value < 50 || value > 2000) throw new Error("50~2000MB 사이로 입력해 주세요.");
  localStorage.setItem(LIMIT_KEY, String(value));
}
export async function checkStorageCapacity(bytes: number) {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  if (!estimate || estimate.usage === undefined) return;
  const limit = Math.min(storageLimitMB() * 1024 ** 2, estimate.quota ?? Infinity);
  if (estimate.usage + Math.max(0, bytes) > limit) {
    throw new Error("저장공간이 부족합니다. 설정에서 자료를 정리하거나 저장 한도를 늘려 주세요.");
  }
}
