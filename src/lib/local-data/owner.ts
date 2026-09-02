"use client";

let configuredOwnerId = "";

export function configureLocalOwner(ownerId: string | null | undefined) {
  configuredOwnerId = ownerId?.trim() ?? "";
}

export function getConfiguredOwnerId() {
  if (configuredOwnerId) return configuredOwnerId;
  if (typeof document === "undefined") return "";
  return document.body.dataset.localOwnerId?.trim() ?? "";
}
