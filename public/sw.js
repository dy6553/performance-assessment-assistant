const CACHE_NAME = "performance-helper-samsung-pwa-v2";
const APP_SHELL = [
  "/",
  "/icon.svg",
  "/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map((url) => cache.add(new Request(url, { cache: "reload" }))),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Keep API/data requests out of the offline cache.
  if (url.pathname.startsWith("/api/")) return;

  // The browser itself uses the web app manifest to decide installability.
  // Never serve it from Cache Storage: repeated PWA deployments can otherwise
  // leave Samsung Internet/Chrome evaluating an older manifest indefinitely.
  if (url.pathname === "/manifest.webmanifest") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok && url.pathname === "/") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(event.request);
          if (cachedPage) return cachedPage;

          const cachedShell = await caches.match("/");
          return cachedShell ?? Response.error();
        }),
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/apple-touch-icon.png";

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, response.clone());
        }
        return response;
      });
    }),
  );
});
