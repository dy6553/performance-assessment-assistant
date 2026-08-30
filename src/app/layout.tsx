import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { PreferenceRuntime } from "@/components/preference-runtime";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { ACCESS_COOKIE } from "@/lib/supabase/auth-cookies";

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
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
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

const preferenceBootScript = `(()=>{try{const d=document.documentElement;const get=(key)=>localStorage.getItem(key);const saved=get("assessment-theme");const theme=saved==="dark"||saved==="light"?saved:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");const font=get("assessment-font-size");const motion=get("assessment-reduce-motion");d.dataset.theme=theme;d.dataset.fontSize=font==="small"||font==="large"?font:"default";d.dataset.reduceMotion=motion==="1"||(motion===null&&matchMedia("(prefers-reduced-motion: reduce)").matches)?"true":"false";d.dataset.highContrast=get("assessment-high-contrast")==="1"?"true":"false";d.dataset.largeControls=get("assessment-large-controls")==="1"?"true":"false";d.dataset.dataSaver=get("assessment-data-saver")==="1"?"true":"false";d.dataset.fastResponse=get("assessment-fast-response")==="1"?"true":"false";d.style.colorScheme=theme}catch{document.documentElement.dataset.theme="light"}})()`;

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const signedIn = Boolean(cookieStore.get(ACCESS_COOKIE)?.value);

  return (
    <html lang="ko" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: preferenceBootScript }} /></head>
      <body>
        <ServiceWorkerRegister />
        <PreferenceRuntime />
        <AppShell signedIn={signedIn}>{children}</AppShell>
      </body>
    </html>
  );
}
