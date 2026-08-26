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

// Samsung Internet's published PWA indication criteria require the page to
// register a Service Worker. Register it from <head> so the browser can observe
// the registration as early as possible. We deliberately do not intercept
// beforeinstallprompt: Samsung Internet/Chrome keep control of their native
// install indication and install UI.
const samsungPwaBootScript =
  process.env.NODE_ENV === "production"
    ? `
(function () {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .catch(function () {
      // /pwa-debug reports registration failures without blocking the app.
    });
})();
`
    : "";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {samsungPwaBootScript ? (
          <script dangerouslySetInnerHTML={{ __html: samsungPwaBootScript }} />
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
