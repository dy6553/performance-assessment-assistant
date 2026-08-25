"use client";

import { useEffect } from "react";

const CONTROLLER_REFRESH_KEY = "performance-helper-pwa-controller-refresh";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let disposed = false;

    const onControllerChange = () => {
      try {
        sessionStorage.removeItem(CONTROLLER_REFRESH_KEY);
      } catch {
        // Storage availability must not affect PWA registration.
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        await registration.update();
        await navigator.serviceWorker.ready;

        if (disposed || navigator.serviceWorker.controller) {
          onControllerChange();
          return;
        }

        // Some Chromium-based mobile browsers only surface their native PWA
        // install badge after the active service worker controls the page.
        // Refresh once after first registration so the installability check can
        // run against a controlled page without creating a reload loop.
        try {
          if (sessionStorage.getItem(CONTROLLER_REFRESH_KEY) !== "1") {
            sessionStorage.setItem(CONTROLLER_REFRESH_KEY, "1");
            window.location.reload();
          }
        } catch {
          // The site remains usable if session storage is unavailable.
        }
      } catch {
        // PWA registration failure must not block normal web usage.
      }
    })();

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
