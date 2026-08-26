import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "수행평가 도우미",
    template: "%s | 수행평가 도우미",
  },
  description:
    "교사 요구조건·교육과정·루브릭을 먼저 분석하고 전략, 초안, 검증 근거를 함께 제공하는 수행평가 AI 앱",
  applicationName: "수행평가 도우미",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "수행평가 도우미",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7c3aed",
};

// Installability can be evaluated very early on Chromium-based browsers.
// Capture the install event before React hydrates, but deliberately delay
// Service Worker registration until window.load. This removes the race where
// the browser can evaluate/install before the React install button has mounted.
// Only this script owns beforeinstallprompt; the React button consumes the
// stored event and never registers a second beforeinstallprompt listener.
const pwaBootScript =
  process.env.NODE_ENV === "production"
    ? `
(function () {
  window.__pwaInstallPrompt = window.__pwaInstallPrompt || null;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    window.__pwaInstallPrompt = event;
    window.dispatchEvent(new Event("pwa-install-prompt-ready"));
  });

  window.addEventListener("appinstalled", function () {
    window.__pwaInstallPrompt = null;
    window.dispatchEvent(new Event("pwa-app-installed"));
  });

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(function () {
        // /pwa-debug reports registration failures without blocking the app.
      });
  }

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker, { once: true });
  }
})();
`
    : "";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {pwaBootScript ? <script dangerouslySetInnerHTML={{ __html: pwaBootScript }} /> : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
