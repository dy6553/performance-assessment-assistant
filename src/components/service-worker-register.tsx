"use client";

import { useEffect } from "react";

type DiagnosticEntry = {
  at: number;
  message: string;
  detail?: string;
};

type PwaRuntimeDiagnostics = {
  startedAt: number;
  events: DiagnosticEntry[];
};

declare global {
  interface Window {
    __pwaRuntimeDiagnostics?: PwaRuntimeDiagnostics;
  }
}

function recordDiagnostic(message: string, detail?: string) {
  const current = window.__pwaRuntimeDiagnostics ?? {
    startedAt: Date.now(),
    events: [],
  };

  const entry: DiagnosticEntry = {
    at: Date.now(),
    message,
    detail,
  };

  current.events = [...current.events.slice(-49), entry];
  window.__pwaRuntimeDiagnostics = current;
  window.dispatchEvent(new CustomEvent("pwa-runtime-diagnostic", { detail: entry }));
}

function describeRegistration(registration: ServiceWorkerRegistration) {
  return [
    `scope=${registration.scope}`,
    `installing=${registration.installing?.state ?? "none"}`,
    `waiting=${registration.waiting?.state ?? "none"}`,
    `active=${registration.active?.state ?? "none"}`,
  ].join(" · ");
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const hasPrompt = typeof (event as Event & { prompt?: unknown }).prompt === "function";
      recordDiagnostic(
        "beforeinstallprompt",
        `prompt=${String(hasPrompt)} · defaultPrevented=${String(event.defaultPrevented)}`,
      );
    };

    const onAppInstalled = () => {
      recordDiagnostic("appinstalled");
    };

    const onControllerChange = () => {
      recordDiagnostic(
        "controllerchange",
        navigator.serviceWorker.controller?.scriptURL ?? "controller 없음",
      );
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (!("serviceWorker" in navigator)) {
      recordDiagnostic("service worker 미지원");
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.removeEventListener("appinstalled", onAppInstalled);
      };
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    if (process.env.NODE_ENV !== "production") {
      recordDiagnostic("service worker 등록 생략", `NODE_ENV=${process.env.NODE_ENV}`);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
        window.removeEventListener("appinstalled", onAppInstalled);
        navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      };
    }

    const registerServiceWorker = () => {
      recordDiagnostic("service worker register 시작", `/sw.js · readyState=${document.readyState}`);

      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(async (registration) => {
          recordDiagnostic("service worker register 성공", describeRegistration(registration));

          const workers = [registration.installing, registration.waiting, registration.active].filter(
            (worker): worker is ServiceWorker => Boolean(worker),
          );

          for (const worker of workers) {
            worker.addEventListener("statechange", () => {
              recordDiagnostic("service worker statechange", `${worker.scriptURL} · ${worker.state}`);
            });
          }

          try {
            await registration.update();
            recordDiagnostic("service worker update 완료", describeRegistration(registration));
          } catch (error) {
            recordDiagnostic(
              "service worker update 실패",
              error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            );
          }
        })
        .catch((error) => {
          recordDiagnostic(
            "service worker register 실패",
            error instanceof Error ? `${error.name}: ${error.message}` : String(error),
          );
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }

    return () => {
      window.removeEventListener("load", registerServiceWorker);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
