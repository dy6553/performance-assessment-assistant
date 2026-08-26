"use client";

import { useEffect, useState } from "react";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

declare global {
  interface Window {
    __pwaInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as NavigatorWithStandalone).standalone)
  );
}

function isSamsungInternet() {
  return /SamsungBrowser\//i.test(navigator.userAgent);
}

function isIos() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}

export function InstallAppButton() {
  const [installed, setInstalled] = useState(false);
  const [samsungInternet, setSamsungInternet] = useState(false);
  const [ios, setIos] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [prompting, setPrompting] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setSamsungInternet(isSamsungInternet());
    setIos(isIos());

    if (window.__pwaInstallPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
    }

    const rememberPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      window.__pwaInstallPrompt = event;
      setInstallPrompt(event);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      rememberPrompt(event as BeforeInstallPromptEvent);
    };

    const onEarlyPromptReady = () => {
      if (window.__pwaInstallPrompt) {
        setInstallPrompt(window.__pwaInstallPrompt);
      }
    };

    const onInstalled = () => {
      window.__pwaInstallPrompt = null;
      setInstalled(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("pwa-install-prompt-ready", onEarlyPromptReady);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("pwa-install-prompt-ready", onEarlyPromptReady);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const canPromptInstall = Boolean(installPrompt) && !ios;
  const buttonLabel = ios ? "홈 화면에 추가" : canPromptInstall ? "앱 설치" : "앱 설치 안내";

  const handleInstallClick = async () => {
    const promptEvent = installPrompt ?? window.__pwaInstallPrompt ?? null;

    if (!promptEvent || ios) {
      setHelpOpen(true);
      return;
    }

    try {
      setPrompting(true);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      // The browser gives each beforeinstallprompt event a single prompt() use.
      window.__pwaInstallPrompt = null;
      setInstallPrompt(null);

      if (choice.outcome === "accepted") {
        setHelpOpen(false);
      }
    } catch {
      window.__pwaInstallPrompt = null;
      setInstallPrompt(null);
      setHelpOpen(true);
    } finally {
      setPrompting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        disabled={prompting}
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
        aria-label="수행평가 도우미 앱 설치"
      >
        {prompting ? "설치창 여는 중…" : buttonLabel}
      </button>

      {helpOpen ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4"
          role="presentation"
          onClick={() => setHelpOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-help-title"
            className="w-full max-w-sm rounded-[2rem] border border-violet-100 bg-white p-6 text-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="install-help-title" className="text-xl font-black">
              {ios
                ? "iPhone/iPad에 설치"
                : samsungInternet
                  ? "삼성 인터넷에서 설치"
                  : "Chrome에서 설치"}
            </h2>

            {ios ? (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                <li>Safari의 <strong>공유</strong> 버튼을 누릅니다.</li>
                <li><strong>홈 화면에 추가</strong>를 선택합니다.</li>
                <li>오른쪽 위 <strong>추가</strong>를 눌러 완료합니다.</li>
              </ol>
            ) : samsungInternet ? (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  현재 브라우저에서 웹페이지가 직접 호출할 수 있는 설치 프롬프트가 아직 제공되지 않았습니다.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>페이지를 한 번 새로고침합니다.</li>
                  <li>주소창의 <strong>설치(+) 아이콘</strong> 또는 메뉴의 설치 항목을 확인합니다.</li>
                  <li>설치가 끝나면 앱스 화면의 <strong>수행평가 도우미</strong>를 실행합니다.</li>
                </ol>
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  계속 표시되지 않으면 <strong>/pwa-debug</strong>에서 Manifest와 Service Worker 상태를 확인할 수 있습니다.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  아직 브라우저가 이 페이지에 PWA 설치 프롬프트를 제공하지 않았습니다.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>페이지를 한 번 새로고침합니다.</li>
                  <li>Chrome의 <strong>⋮ 메뉴</strong>를 엽니다.</li>
                  <li><strong>설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택합니다.</li>
                </ol>
                <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  설치 조건이 충족되면 이 버튼의 이름이 자동으로 <strong>앱 설치</strong>로 바뀌고, 누르는 즉시 브라우저 설치창이 열립니다.
                </p>
              </>
            )}

            <button
              type="button"
              className="mt-5 min-h-11 w-full rounded-xl bg-violet-600 px-4 font-black text-white transition hover:bg-violet-700 active:scale-[0.99]"
              onClick={() => setHelpOpen(false)}
            >
              확인
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
