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

const pwaBootScript =
  process.env.NODE_ENV === "production"
    ? `
(function () {
  window.__pwaInstallPrompt = window.__pwaInstallPrompt || null;

  window.addEventListener("beforeinstallprompt", function (event) {
    // Capture the event before React hydration. Some Chromium-based browsers can
    // emit it before client components have mounted.
    event.preventDefault();
    window.__pwaInstallPrompt = event;
    window.dispatchEvent(new Event("pwa-install-prompt-ready"));
  });

  window.addEventListener("appinstalled", function () {
    window.__pwaInstallPrompt = null;
    window.dispatchEvent(new Event("pwa-app-installed"));
  });

  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(function (registration) {
      return registration.update();
    })
    .catch(function () {
      // PWA installation diagnostics handle registration failures separately.
    });
})();
`
    : "";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {pwaBootScript ? (
          <script dangerouslySetInnerHTML={{ __html: pwaBootScript }} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
