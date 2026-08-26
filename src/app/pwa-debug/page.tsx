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

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type ManifestIcon = {
  sizes?: string;
  src?: string;
  type?: string;
  purpose?: string;
};

function iconHasMinimumSize(icon: ManifestIcon, minimum: number) {
  if (!icon.sizes) return false;

  return icon.sizes.split(/\s+/).some((token) => {
    const match = token.match(/^(\d+)x(\d+)$/i);
    if (!match) return false;
    return Number(match[1]) >= minimum && Number(match[2]) >= minimum;
  });
}

function hasExactSize(icon: ManifestIcon, size: number) {
  return Boolean(
    icon.sizes
      ?.split(/\s+/)
      .some((token) => token.toLowerCase() === `${size}x${size}`),
  );
}

async function readImageSize(src: string) {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
    image.src = `${src}${src.includes("?") ? "&" : "?"}pwa-check=${Date.now()}`;
  });
}

export default function PwaDebugPage() {
  const [checks, setChecks] = useState<Check[]>([
    { label: "진단 준비", value: "확인 중…", ok: null },
  ]);
  const [promptSeen, setPromptSeen] = useState(false);
  const [samsungInternet, setSamsungInternet] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let active = true;
    const isSamsung = /SamsungBrowser\//i.test(navigator.userAgent);
    setSamsungInternet(isSamsung);

    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      if (typeof installEvent.prompt === "function") {
        // Diagnostic only. Do not call preventDefault(): Samsung Internet/Chrome
        // should retain control of the browser-native install promotion.
        setPromptSeen(true);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    void (async () => {
      const next: Check[] = [];

      const secureContext = window.isSecureContext && window.location.protocol === "https:";
      next.push({
        label: "HTTPS / Secure Context",
        value: `${window.location.protocol}//${window.location.host} · secure=${String(window.isSecureContext)}`,
        ok: secureContext,
      });

      const serviceWorkerSupported = "serviceWorker" in navigator;
      next.push({
        label: "Service Worker 지원",
        value: String(serviceWorkerSupported),
        ok: serviceWorkerSupported,
      });

      let serviceWorkerRegistered = false;
      let serviceWorkerActive = false;
      let serviceWorkerControlling = false;

      if (serviceWorkerSupported) {
        try {
          const registration = await navigator.serviceWorker.getRegistration("/");
          serviceWorkerRegistered = Boolean(registration);
          serviceWorkerActive = registration?.active?.state === "activated";
          serviceWorkerControlling = Boolean(navigator.serviceWorker.controller);

          next.push({
            label: "Service Worker 등록",
            value: registration ? `등록됨 · scope ${registration.scope}` : "등록 없음",
            ok: serviceWorkerRegistered,
          });
          next.push({
            label: "Service Worker active",
            value: registration?.active?.state ?? "없음",
            ok: serviceWorkerActive,
          });
          next.push({
            label: "현재 페이지 제어",
            value: serviceWorkerControlling ? "제어 중" : "제어 안 됨 · 새로고침 후 다시 확인",
            ok: serviceWorkerControlling,
          });
        } catch (error) {
          next.push({
            label: "Service Worker 확인",
            value: error instanceof Error ? error.message : "확인 실패",
            ok: false,
          });
        }
      }

      const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      const manifestSameOrigin = Boolean(
        manifestLink && new URL(manifestLink.href).origin === window.location.origin,
      );
      next.push({
        label: "Manifest link",
        value: manifestLink?.href ?? "없음",
        ok: Boolean(manifestLink),
      });
      next.push({
        label: "Manifest 동일 Origin",
        value: manifestLink ? (manifestSameOrigin ? "현재 사이트와 동일" : "다른 Origin") : "Manifest 없음",
        ok: manifestSameOrigin,
      });

      let manifestHttpOk = false;
      let hasName = false;
      let hasStartUrl = false;
      let startUrlHttpOk = false;
      let hasSamsungIcon = false;
      let has192Icon = false;
      let has512Icon = false;
      let icon192FileOk = false;
      let icon512FileOk = false;
      let hasStandaloneDisplay = false;
      let preferWebApp = false;

      try {
        const response = await fetch(`/manifest.webmanifest?pwa-check=${Date.now()}`, {
          cache: "no-store",
        });
        const contentType = response.headers.get("content-type") ?? "";
        manifestHttpOk =
          response.ok && (contentType.includes("manifest") || contentType.includes("json"));

        const manifest = (await response.json()) as {
          id?: string;
          name?: string;
          short_name?: string;
          start_url?: string;
          scope?: string;
          display?: string;
          prefer_related_applications?: boolean;
          icons?: ManifestIcon[];
        };

        hasName = Boolean(manifest.name || manifest.short_name);
        hasStartUrl = Boolean(manifest.start_url);
        hasStandaloneDisplay =
          manifest.display === "standalone" || manifest.display === "fullscreen";
        preferWebApp = manifest.prefer_related_applications !== true;
        hasSamsungIcon = Boolean(manifest.icons?.some((icon) => iconHasMinimumSize(icon, 144)));
        has192Icon = Boolean(manifest.icons?.some((icon) => hasExactSize(icon, 192)));
        has512Icon = Boolean(manifest.icons?.some((icon) => hasExactSize(icon, 512)));

        next.push({
          label: "Manifest HTTP",
          value: `${response.status} · ${contentType}`,
          ok: manifestHttpOk,
        });
        next.push({
          label: "name / short_name",
          value: manifest.name ?? manifest.short_name ?? "없음",
          ok: hasName,
        });
        next.push({ label: "start_url", value: manifest.start_url ?? "없음", ok: hasStartUrl });
        next.push({ label: "scope", value: manifest.scope ?? "없음", ok: Boolean(manifest.scope) });
        next.push({
          label: "display",
          value: manifest.display ?? "없음",
          ok: hasStandaloneDisplay,
        });
        next.push({
          label: "Samsung 기준 아이콘 ≥144×144",
          value: hasSamsungIcon ? "있음" : "없음",
          ok: hasSamsungIcon,
        });
        next.push({
          label: "192×192 Manifest 선언",
          value: has192Icon ? "있음" : "없음",
          ok: has192Icon,
        });
        next.push({
          label: "512×512 Manifest 선언",
          value: has512Icon ? "있음" : "없음",
          ok: has512Icon,
        });
        next.push({
          label: "웹앱 직접 설치 우선",
          value: preferWebApp ? "웹앱 설치 우선" : "앱스토어 우선",
          ok: preferWebApp,
        });

        if (manifest.start_url) {
          try {
            const startUrl = new URL(manifest.start_url, window.location.origin);
            const startResponse = await fetch(`${startUrl.pathname}${startUrl.search}`, {
              cache: "no-store",
            });
            startUrlHttpOk = startResponse.ok;
            next.push({
              label: "start_url 실제 응답",
              value: `${startResponse.status} · ${startUrl.href}`,
              ok: startUrlHttpOk,
            });
          } catch (error) {
            next.push({
              label: "start_url 실제 응답",
              value: error instanceof Error ? error.message : "확인 실패",
              ok: false,
            });
          }
        }

        const icon192 = manifest.icons?.find((icon) => hasExactSize(icon, 192) && icon.src);
        const icon512 = manifest.icons?.find((icon) => hasExactSize(icon, 512) && icon.src);

        if (icon192?.src) {
          try {
            const size = await readImageSize(new URL(icon192.src, window.location.origin).href);
            icon192FileOk = size.width === 192 && size.height === 192;
            next.push({
              label: "192×192 아이콘 실제 파일",
              value: `${size.width}×${size.height} · ${icon192.type ?? "type 미지정"}`,
              ok: icon192FileOk,
            });
          } catch (error) {
            next.push({
              label: "192×192 아이콘 실제 파일",
              value: error instanceof Error ? error.message : "확인 실패",
              ok: false,
            });
          }
        }

        if (icon512?.src) {
          try {
            const size = await readImageSize(new URL(icon512.src, window.location.origin).href);
            icon512FileOk = size.width === 512 && size.height === 512;
            next.push({
              label: "512×512 아이콘 실제 파일",
              value: `${size.width}×${size.height} · ${icon512.type ?? "type 미지정"}`,
              ok: icon512FileOk,
            });
          } catch (error) {
            next.push({
              label: "512×512 아이콘 실제 파일",
              value: error instanceof Error ? error.message : "확인 실패",
              ok: false,
            });
          }
        }
      } catch (error) {
        next.push({
          label: "Manifest 읽기",
          value: error instanceof Error ? error.message : "읽기 실패",
          ok: false,
        });
      }

      const samsungCriteria = [
        secureContext,
        serviceWorkerRegistered,
        Boolean(manifestLink),
        manifestHttpOk,
        hasName,
        hasStartUrl,
        hasSamsungIcon,
        hasStandaloneDisplay,
      ];
      const samsungPassed = samsungCriteria.filter(Boolean).length;
      next.push({
        label: "Samsung Internet 공개 PWA 기준",
        value: `${samsungPassed}/${samsungCriteria.length} 충족 · Samsung의 공개 문서는 구버전 기준이며 실제 최신 브라우저 정책은 달라질 수 있음`,
        ok: samsungPassed === samsungCriteria.length,
      });

      const chromiumCriteria = [
        secureContext,
        manifestHttpOk,
        hasName,
        hasStartUrl,
        startUrlHttpOk,
        has192Icon,
        has512Icon,
        icon192FileOk,
        icon512FileOk,
        hasStandaloneDisplay,
        preferWebApp,
      ];
      const chromiumPassed = chromiumCriteria.filter(Boolean).length;
      next.push({
        label: "Chromium 계열 Manifest/응답 기준",
        value: `${chromiumPassed}/${chromiumCriteria.length} 충족 · 192/512 실제 파일과 start_url 200까지 검사`,
        ok: chromiumPassed === chromiumCriteria.length,
      });

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as NavigatorWithStandalone).standalone);
      next.push({
        label: "standalone 실행 상태",
        value: standalone ? "설치 앱으로 실행 중" : "브라우저 탭",
        ok: null,
      });
      next.push({ label: "User Agent", value: navigator.userAgent, ok: null });

      if (isSamsung) {
        next.push({
          label: "삼성 인터넷 공식 설치 경로",
          value: "주소창 설치(+) 아이콘 → 앱스 화면에 설치",
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

  const resetPwaState = async () => {
    if (resetting) return;
    setResetting(true);

    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } finally {
      window.location.reload();
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 text-slate-950">
      <h1 className="text-3xl font-black">PWA 설치 진단</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Samsung Internet의 공개 기준과 현재 Chromium 계열의 실제 Manifest/파일 상태를 함께 확인합니다.
      </p>

      <button
        type="button"
        onClick={() => void resetPwaState()}
        disabled={resetting}
        className="mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50"
      >
        {resetting ? "초기화 중…" : "PWA 캐시·Service Worker 초기화"}
      </button>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        여러 번 PWA 설정을 바꾼 뒤 브라우저가 예전 Manifest/Service Worker 상태를 계속 보는 경우에만 사용하세요.
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
            <span className="text-lg" aria-hidden="true">{promptSeen ? "✅" : "•"}</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {promptSeen
              ? "브라우저가 설치 이벤트를 보냈습니다. 수행평가 도우미는 이벤트를 취소하지 않고 브라우저 기본 설치 UI를 유지합니다."
              : samsungInternet
                ? "Samsung Internet에서는 이 이벤트 하나만으로 설치 가능 여부를 판단할 수 없습니다. 위의 실제 Manifest/파일 검사를 우선 확인하세요."
                : "Chrome은 설치 프로모션에 사용자 참여 조건도 적용합니다. 앱이 이미 설치되어 있지 않아야 하며, 페이지 탭/클릭과 누적 약 30초 사용 조건이 필요할 수 있습니다."}
          </p>
        </section>
      </div>
    </main>
  );
}
