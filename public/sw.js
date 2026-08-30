const CACHE_NAME = "performance-helper-shell-v2";
const HISTORY_CACHE_NAME = "performance-helper-history-v1";
const HISTORY_PREFIX = "/__wanhee_assignment_history__/";
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"];

const TRACKED_ASSIGNMENT_REQUESTS = {
  "/api/assignment/analyze": { operation: "analyze", label: "과제 분석" },
  "/api/assignment/generate": { operation: "generate", label: "초안 작성" },
  "/api/assignment/verify": { operation: "verify", label: "초안 독립 검증" },
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME && key !== HISTORY_CACHE_NAME).map((key) => caches.delete(key)))),
      purgeExpiredHistory(),
    ]).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.method === "POST") {
    const tracked = TRACKED_ASSIGNMENT_REQUESTS[url.pathname];
    if (tracked) {
      event.respondWith(trackAssignmentRequest(event.request, tracked));
    }
    return;
  }

  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/")));
  }
});

async function trackAssignmentRequest(request, tracked) {
  let body = null;
  try {
    body = await request.clone().json();
  } catch {
    return fetch(request);
  }

  const assignment = body?.assignment;
  if (!assignment || typeof assignment !== "object") return fetch(request);

  const fingerprint = await fingerprintAssignment(assignment);
  const startedAt = Date.now();
  const expiresAt = startedAt + HISTORY_TTL_MS;
  const cache = await caches.open(HISTORY_CACHE_NAME);
  const historyRequest = historyCacheRequest(fingerprint, tracked.operation);

  await purgeExpiredHistory(cache);
  await writeHistory(cache, historyRequest, {
    version: 1,
    fingerprint,
    operation: tracked.operation,
    label: tracked.label,
    state: "RUNNING",
    assignment,
    requestBody: body,
    responseBody: null,
    httpStatus: null,
    startedAt,
    finishedAt: null,
    expiresAt,
    error: null,
  });

  try {
    const response = await fetch(request);
    const clone = response.clone();
    let responseBody = null;
    try {
      responseBody = await clone.json();
    } catch {
      responseBody = null;
    }

    const finishedAt = Date.now();
    await writeHistory(cache, historyRequest, {
      version: 1,
      fingerprint,
      operation: tracked.operation,
      label: tracked.label,
      state: response.ok ? "DONE" : "ERROR",
      assignment,
      requestBody: body,
      responseBody,
      httpStatus: response.status,
      startedAt,
      finishedAt,
      expiresAt: finishedAt + HISTORY_TTL_MS,
      error: response.ok ? null : responseBody?.error || `${tracked.label} 요청이 실패했습니다.`,
    });

    return response;
  } catch (error) {
    const finishedAt = Date.now();
    await writeHistory(cache, historyRequest, {
      version: 1,
      fingerprint,
      operation: tracked.operation,
      label: tracked.label,
      state: "ERROR",
      assignment,
      requestBody: body,
      responseBody: null,
      httpStatus: null,
      startedAt,
      finishedAt,
      expiresAt: finishedAt + HISTORY_TTL_MS,
      error: error instanceof Error ? error.message : "네트워크 요청이 중단되었습니다.",
    });
    throw error;
  }
}

async function fingerprintAssignment(assignment) {
  const normalized = JSON.stringify(assignment, Object.keys(assignment).sort());
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

function historyCacheRequest(fingerprint, operation) {
  return new Request(`${self.location.origin}${HISTORY_PREFIX}${fingerprint}/${operation}`);
}

async function writeHistory(cache, request, value) {
  await cache.put(
    request,
    new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }),
  );
}

async function purgeExpiredHistory(existingCache) {
  const cache = existingCache || (await caches.open(HISTORY_CACHE_NAME));
  const keys = await cache.keys();
  const now = Date.now();

  await Promise.all(
    keys.map(async (key) => {
      try {
        const response = await cache.match(key);
        const record = response ? await response.json() : null;
        if (!record?.expiresAt || Number(record.expiresAt) <= now) await cache.delete(key);
      } catch {
        await cache.delete(key);
      }
    }),
  );
}
