"use client";

import { useEffect, useState } from "react";

type Check = {
  label: string;
  value: string;
  ok: boolean | null;
};

type BeforeInstallPromptEvent = Event & {
  prompt?: () => Promise<unknown>;
};

export default function PwaDebugPage() {
  const [checks, setChecks] = useState<Check[]>([
    { label: "진단 준비", value: "확인 중…", ok: null },
  ]);
  const [promptSeen, setPromptSeen] = useState(false);
  const [samsungInternet, setSamsungInternet] = useState(false);

  useEffect(() => {
    let active = true;
    const isSamsung = /SamsungBrowser\//i.test(navigator.userAgent);
    setSamsungInternet(isSamsung);

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      if (typeof installEvent.prompt === "function") {
        setPromptSeen(true);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    void (async () => {
      const next: Check[] = [];
      next.push({ label: "HTTPS / Secure Context", value: String(window.isSecureContext), ok: window.isSecureContext });
      next.push({ label: "Service Worker 지원", value: String("serviceWorker" in navigator), ok: "serviceWorker" in navigator });

      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration("/");
          next.push({
            label: "Service Worker 등록",
            value: registration ? `등록됨 · scope ${registration.scope}` : "등록 없음",
            ok: Boolean(registration),
          });
          next.push({
            label: "Service Worker active",
            value: registration?.active?.state ?? "없음",
            ok: registration?.active?.state === "activated",
          });
          next.push({
            label: "현재 페이지 제어",
            value: navigator.serviceWorker.controller ? "제어 중" : "제어 안 됨",
            ok: Boolean(navigator.serviceWorker.controller),
          });
        } catch (error) {
          next.push({ label: "Service Worker 확인", value: error instanceof Error ? error.message : "확인 실패", ok: false });
        }
      }

      const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      next.push({
        label: "Manifest link",
        value: manifestLink?.href ?? "없음",
        ok: Boolean(manifestLink),
      });

      try {
        const response = await fetch("/manifest.webmanifest", { cache: "no-store" });
        const contentType = response.headers.get("content-type") ?? "";
        const manifest = (await response.json()) as {
          name?: string;
          short_name?: string;
          start_url?: string;
          display?: string;
          icons?: Array<{ sizes?: string; src?: string }>;
        };
        next.push({ label: "Manifest HTTP", value: `${response.status} · ${contentType}`, ok: response.ok && contentType.includes("manifest") });
        next.push({ label: "name / short_name", value: manifest.name ?? manifest.short_name ?? "없음", ok: Boolean(manifest.name || manifest.short_name) });
        next.push({ label: "start_url", value: manifest.start_url ?? "없음", ok: Boolean(manifest.start_url) });
        next.push({ label: "display", value: manifest.display ?? "없음", ok: manifest.display === "standalone" || manifest.display === "fullscreen" });
        const hasLargeIcon = Boolean(
          manifest.icons?.some((icon) => {
            const match = icon.sizes?.match(/^(\d+)x(\d+)$/);
            return match ? Number(match[1]) >= 144 && Number(match[2]) >= 144 : false;
          }),
        );
        next.push({ label: "144px 이상 아이콘", value: hasLargeIcon ? "있음" : "없음", ok: hasLargeIcon });
      } catch (error) {
        next.push({ label: "Manifest 읽기", value: error instanceof Error ? error.message : "읽기 실패", ok: false });
      }

      next.push({
        label: "standalone 실행 상태",
        value: window.matchMedia("(display-mode: standalone)").matches ? "설치 앱으로 실행 중" : "브라우저 탭",
        ok: null,
      });
      next.push({ label: "User Agent", value: navigator.userAgent, ok: null });

      if (isSamsung) {
        next.push({
          label: "삼성 인터넷 설치 경로",
          value: "메뉴 → 현재 페이지 추가 → 앱스 화면",
          ok: true,
        });
      }

      if (active) setChecks(next);
    })();

    return () => {
      active = false;
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 text-slate-950">
      <h1 className="text-3xl font-black">PWA 설치 진단</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        이 화면은 수행평가 도우미의 PWA 구성과 브라우저 설치 상태를 확인합니다.
      </p>

      <div className="mt-6 space-y-3">
        {checks.map((check) => (
          <section key={check.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-black">{check.label}</p>
              <span className="text-lg" aria-hidden="true">
                {check.ok === null ? "•" : check.ok ? "✅" : "❌"}
              </span>
            </div>
            <p className="mt-1 break-all text-sm leading-6 text-slate-600">{check.value}</p>
          </section>
        ))}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="font-black">beforeinstallprompt</p>
            <span className="text-lg" aria-hidden="true">{promptSeen ? "✅" : samsungInternet ? "•" : "❌"}</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {promptSeen
              ? "브라우저가 웹 페이지에 네이티브 설치 이벤트를 보냈습니다."
              : samsungInternet
                ? "삼성 인터넷에서는 이 이벤트가 없어도 브라우저의 설치 아이콘 또는 메뉴 → 현재 페이지 추가 → 앱스 화면 경로로 PWA를 설치할 수 있습니다."
                : "현재 세션에서는 설치 가능 이벤트가 감지되지 않았습니다."}
          </p>
        </section>
      </div>
    </main>
  );
}
