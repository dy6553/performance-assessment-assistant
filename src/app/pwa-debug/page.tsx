"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Check = {
  label: string;
  value: string;
  ok: boolean | null;
};

type DiagnosticEntry = {
  at: number;
  message: string;
  detail?: string;
};

type PwaRuntimeDiagnostics = {
  startedAt: number;
  events: DiagnosticEntry[];
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

type ManifestShape = {
  id?: string;
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  prefer_related_applications?: boolean;
  icons?: ManifestIcon[];
};

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function formatError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function hasExactSize(icon: ManifestIcon, size: number) {
  return Boolean(
    icon.sizes
      ?.split(/\s+/)
      .some((token) => token.toLowerCase() === `${size}x${size}`),
  );
}

function iconHasMinimumSize(icon: ManifestIcon, minimum: number) {
  if (!icon.sizes) return false;

  return icon.sizes.split(/\s+/).some((token) => {
    const match = token.match(/^(\d+)x(\d+)$/i);
    if (!match) return false;
    return Number(match[1]) >= minimum && Number(match[2]) >= minimum;
  });
}

async function readImageSize(src: string) {
  return await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`이미지 로드 실패: ${src}`));
    image.src = `${src}${src.includes("?") ? "&" : "?"}pwa-check=${Date.now()}`;
  });
}

function getRuntimeDiagnostics() {
  return (window as Window & { __pwaRuntimeDiagnostics?: PwaRuntimeDiagnostics })
    .__pwaRuntimeDiagnostics;
}

function describeWorker(worker: ServiceWorker | null | undefined) {
  if (!worker) return "없음";
  return `${worker.state} · ${worker.scriptURL}`;
}

export default function PwaDebugPage() {
  const [checks, setChecks] = useState<Check[]>([
    { label: "진단 준비", value: "Service Worker 등록을 기다리는 중…", ok: null },
  ]);
  const [runtimeEvents, setRuntimeEvents] = useState<DiagnosticEntry[]>([]);
  const [verdict, setVerdict] = useState("진단 중입니다. 최대 약 12초 걸릴 수 있습니다.");
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copied, setCopied] = useState(false);
  const runningRef = useRef(false);
  const promptSeenRef = useRef<number | null>(null);
  const appInstalledRef = useRef<number | null>(null);

  const runDiagnostics = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setCopied(false);

    try {
      const next: Check[] = [];
      const secureContext = window.isSecureContext && window.location.protocol === "https:";
      const isSamsung = /SamsungBrowser\//i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as NavigatorWithStandalone).standalone);

      next.push({
        label: "HTTPS / Secure Context",
        value: `${window.location.protocol}//${window.location.host} · secure=${String(window.isSecureContext)}`,
        ok: secureContext,
      });
      next.push({
        label: "브라우저",
        value: isSamsung ? "Samsung Internet 감지" : navigator.userAgent,
        ok: isSamsung ? true : null,
      });
      next.push({
        label: "standalone 실행 상태",
        value: standalone ? "이미 설치된 앱으로 실행 중" : "브라우저 탭",
        ok: null,
      });

      const serviceWorkerSupported = "serviceWorker" in navigator;
      next.push({
        label: "Service Worker 지원",
        value: String(serviceWorkerSupported),
        ok: serviceWorkerSupported,
      });

      let swHttpOk = false;
      try {
        const swResponse = await fetch(`/sw.js?pwa-check=${Date.now()}`, { cache: "no-store" });
        const contentType = swResponse.headers.get("content-type") ?? "";
        const allowed = swResponse.headers.get("service-worker-allowed") ?? "헤더 없음";
        swHttpOk = swResponse.ok && contentType.includes("javascript");
        next.push({
          label: "/sw.js 실제 응답",
          value: `${swResponse.status} · ${contentType} · Service-Worker-Allowed=${allowed}`,
          ok: swHttpOk,
        });
      } catch (error) {
        next.push({ label: "/sw.js 실제 응답", value: formatError(error), ok: false });
      }

      let registration: ServiceWorkerRegistration | undefined;
      let readyRegistration: ServiceWorkerRegistration | undefined;
      let serviceWorkerRegistered = false;
      let serviceWorkerActive = false;
      let serviceWorkerControlling = false;

      if (serviceWorkerSupported) {
        try {
          registration = await navigator.serviceWorker.getRegistration("/");

          if (!registration) {
            for (let attempt = 0; attempt < 16; attempt += 1) {
              await delay(250);
              registration = await navigator.serviceWorker.getRegistration("/");
              if (registration) break;
            }
          }

          try {
            readyRegistration = await withTimeout(
              navigator.serviceWorker.ready,
              8000,
              "navigator.serviceWorker.ready가 8초 안에 완료되지 않음",
            );
          } catch (error) {
            next.push({
              label: "navigator.serviceWorker.ready",
              value: formatError(error),
              ok: false,
            });
          }

          registration = registration ?? readyRegistration;
          serviceWorkerRegistered = Boolean(registration);
          serviceWorkerActive = registration?.active?.state === "activated";
          serviceWorkerControlling = Boolean(navigator.serviceWorker.controller);

          next.push({
            label: "Service Worker 등록",
            value: registration ? `등록됨 · scope ${registration.scope}` : "약 12초 동안 등록을 찾지 못함",
            ok: serviceWorkerRegistered,
          });
          next.push({
            label: "installing worker",
            value: describeWorker(registration?.installing),
            ok: null,
          });
          next.push({
            label: "waiting worker",
            value: describeWorker(registration?.waiting),
            ok: null,
          });
          next.push({
            label: "active worker",
            value: describeWorker(registration?.active),
            ok: serviceWorkerActive,
          });
          next.push({
            label: "현재 페이지 제어(controller)",
            value: navigator.serviceWorker.controller?.scriptURL ?? "controller 없음",
            ok: serviceWorkerControlling,
          });
        } catch (error) {
          next.push({ label: "Service Worker 확인", value: formatError(error), ok: false });
        }
      }

      const runtime = getRuntimeDiagnostics();
      const events = runtime?.events ?? [];
      setRuntimeEvents(events);
      const registerFailure = [...events]
        .reverse()
        .find((entry) => entry.message === "service worker register 실패");
      const registerSuccess = events.some((entry) => entry.message === "service worker register 성공");
      const runtimePromptSeen = events.some((entry) => entry.message === "beforeinstallprompt");
      const runtimeInstalled = events.some((entry) => entry.message === "appinstalled");

      next.push({
        label: "등록 코드 실행 기록",
        value: registerFailure
          ? `실패 · ${registerFailure.detail ?? "상세 없음"}`
          : registerSuccess
            ? "navigator.serviceWorker.register('/sw.js') 성공 기록 있음"
            : "아직 register 성공/실패 기록 없음",
        ok: registerFailure ? false : registerSuccess ? true : null,
      });

      const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      const manifestSameOrigin = Boolean(
        manifestLink && new URL(manifestLink.href).origin === window.location.origin,
      );
      next.push({
        label: "Manifest link",
        value: manifestLink?.href ?? "없음",
        ok: Boolean(manifestLink) && manifestSameOrigin,
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
        const manifest = (await response.json()) as ManifestShape;

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
          label: "Manifest 핵심 값",
          value: `id=${manifest.id ?? "없음"} · start_url=${manifest.start_url ?? "없음"} · scope=${manifest.scope ?? "없음"} · display=${manifest.display ?? "없음"}`,
          ok: hasName && hasStartUrl && hasStandaloneDisplay,
        });
        next.push({
          label: "Manifest 아이콘 선언",
          value: `≥144=${String(hasSamsungIcon)} · 192=${String(has192Icon)} · 512=${String(has512Icon)}`,
          ok: hasSamsungIcon && has192Icon && has512Icon,
        });

        if (manifest.start_url) {
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
        }

        const icon192 = manifest.icons?.find((icon) => hasExactSize(icon, 192) && icon.src);
        const icon512 = manifest.icons?.find((icon) => hasExactSize(icon, 512) && icon.src);

        if (icon192?.src) {
          const size = await readImageSize(new URL(icon192.src, window.location.origin).href);
          icon192FileOk = size.width === 192 && size.height === 192;
          next.push({
            label: "192×192 아이콘 실제 파일",
            value: `${size.width}×${size.height} · ${icon192.type ?? "type 미지정"}`,
            ok: icon192FileOk,
          });
        }

        if (icon512?.src) {
          const size = await readImageSize(new URL(icon512.src, window.location.origin).href);
          icon512FileOk = size.width === 512 && size.height === 512;
          next.push({
            label: "512×512 아이콘 실제 파일",
            value: `${size.width}×${size.height} · ${icon512.type ?? "type 미지정"}`,
            ok: icon512FileOk,
          });
        }
      } catch (error) {
        next.push({ label: "Manifest/아이콘 검사", value: formatError(error), ok: false });
      }

      const promptSeen = Boolean(promptSeenRef.current) || runtimePromptSeen;
      const appInstalled = Boolean(appInstalledRef.current) || runtimeInstalled;
      next.push({
        label: "beforeinstallprompt 이벤트",
        value: promptSeen
          ? "이 브라우저 세션에서 발생 확인"
          : "아직 감지되지 않음 · 브라우저가 설치 가능 이벤트를 보내지 않은 상태",
        ok: promptSeen ? true : null,
      });
      next.push({
        label: "appinstalled 이벤트",
        value: appInstalled ? "설치 완료 이벤트 감지" : "감지되지 않음",
        ok: appInstalled ? true : null,
      });

      const samsungCriteria = [
        secureContext,
        swHttpOk,
        serviceWorkerRegistered,
        serviceWorkerActive,
        Boolean(manifestLink),
        manifestHttpOk,
        hasName,
        hasStartUrl,
        hasSamsungIcon,
        hasStandaloneDisplay,
      ];
      const samsungPassed = samsungCriteria.filter(Boolean).length;
      next.push({
        label: "PWA 기본 설치 조건 점검",
        value: `${samsungPassed}/${samsungCriteria.length} 충족`,
        ok: samsungPassed === samsungCriteria.length,
      });

      const chromiumManifestCriteria = [
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
      const chromiumPassed = chromiumManifestCriteria.filter(Boolean).length;
      next.push({
        label: "Manifest/응답 정밀 점검",
        value: `${chromiumPassed}/${chromiumManifestCriteria.length} 충족`,
        ok: chromiumPassed === chromiumManifestCriteria.length,
      });

      if (registerFailure) {
        setVerdict(`Service Worker 등록 코드에서 실제 오류가 확인됐습니다: ${registerFailure.detail ?? "상세 없음"}`);
      } else if (!serviceWorkerRegistered || !serviceWorkerActive) {
        setVerdict(
          "Service Worker가 제한 시간 안에 등록·활성화되지 않았습니다. 아래 '등록 코드 실행 기록'과 런타임 로그가 핵심 원인입니다.",
        );
      } else if (!serviceWorkerControlling) {
        setVerdict(
          "Service Worker는 활성화됐지만 현재 페이지를 아직 제어하지 않습니다. 한 번 새로고침한 뒤 다시 진단하면 controller 여부를 확정할 수 있습니다.",
        );
      } else if (!promptSeen && !standalone) {
        setVerdict(
          "Service Worker·Manifest·아이콘은 정상인데 beforeinstallprompt가 발생하지 않았습니다. 이 경우 원인은 PWA 파일 자체보다 Samsung Internet의 설치 가능 판정/프로모션 단계로 좁혀집니다.",
        );
      } else if (standalone || appInstalled) {
        setVerdict("PWA 설치 또는 standalone 실행 상태가 확인됐습니다.");
      } else {
        setVerdict("Service Worker와 설치 가능 이벤트가 모두 확인됐습니다. 주소창 설치 UI는 브라우저 측 표시 정책을 확인하면 됩니다.");
      }

      setChecks(next);
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      if (typeof installEvent.prompt === "function") {
        promptSeenRef.current = Date.now();
      }
    };
    const onAppInstalled = () => {
      appInstalledRef.current = Date.now();
    };
    const onRuntimeDiagnostic = () => {
      setRuntimeEvents(getRuntimeDiagnostics()?.events ?? []);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("pwa-runtime-diagnostic", onRuntimeDiagnostic);

    const timer = window.setTimeout(() => {
      void runDiagnostics();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("pwa-runtime-diagnostic", onRuntimeDiagnostic);
    };
  }, [runDiagnostics]);

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
      window.location.replace(`/pwa-debug?after-reset=${Date.now()}`);
    }
  };

  const copyDiagnostics = async () => {
    const lines = [
      `PWA 진단 시각: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `UA: ${navigator.userAgent}`,
      `결론: ${verdict}`,
      "",
      ...checks.map(
        (check) => `${check.ok === null ? "•" : check.ok ? "OK" : "FAIL"} ${check.label}: ${check.value}`,
      ),
      "",
      "[런타임 이벤트]",
      ...runtimeEvents.map(
        (entry) => `${new Date(entry.at).toISOString()} ${entry.message}${entry.detail ? ` · ${entry.detail}` : ""}`,
      ),
    ];

    await navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8 text-slate-950">
      <h1 className="text-3xl font-black">PWA 설치 정밀 진단</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        단순히 페이지 로딩 직후 한 번 확인하지 않고, Service Worker 등록·활성화·controller와 설치 이벤트를 최대 약 12초 동안 추적합니다.
      </p>

      <section className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">현재 결론</p>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-800">{verdict}</p>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runDiagnostics()}
          disabled={running || resetting}
          className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {running ? "진단 중…" : "다시 진단"}
        </button>
        <button
          type="button"
          onClick={() => void copyDiagnostics()}
          disabled={running}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50"
        >
          {copied ? "복사 완료" : "진단 결과 복사"}
        </button>
        <button
          type="button"
          onClick={() => void resetPwaState()}
          disabled={running || resetting}
          className="min-h-11 rounded-xl border border-rose-200 bg-white px-4 text-sm font-black text-rose-700 disabled:opacity-50"
        >
          {resetting ? "초기화 중…" : "PWA 상태 초기화"}
        </button>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        초기화는 Service Worker와 Cache Storage만 지운 뒤 이 페이지를 다시 엽니다. 초기화 직후에는 자동 재등록을 기다리므로 연속해서 초기화를 누르지 마세요.
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
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-black">Service Worker 런타임 로그</h2>
          <span className="text-xs font-bold text-slate-400">{runtimeEvents.length}건</span>
        </div>
        {runtimeEvents.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-slate-500">아직 등록 코드에서 기록된 이벤트가 없습니다.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {runtimeEvents.map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                <p className="font-black">{entry.message}</p>
                <p className="mt-1 break-all text-slate-500">
                  {new Date(entry.at).toLocaleTimeString("ko-KR")}
                  {entry.detail ? ` · ${entry.detail}` : ""}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
