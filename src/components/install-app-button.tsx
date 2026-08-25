"use client";

import { useEffect, useState } from "react";

type InstallChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
}

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

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
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [samsungInternet, setSamsungInternet] = useState(false);
  const [ios, setIos] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const samsung = isSamsungInternet();

    setInstalled(isStandalone());
    setSamsungInternet(samsung);
    setIos(isIos());

    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;

      // Samsung Internet uses its own install indication in the browser UI.
      // Do not cancel the event there, because that can suppress native install promotion.
      if (!samsung) {
        event.preventDefault();
      }

      setInstallPrompt(promptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const requestInstall = async () => {
    if (!installPrompt) {
      setHelpOpen(true);
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);

      if (choice.outcome === "accepted") {
        setHelpOpen(false);
      }
    } catch {
      setHelpOpen(true);
    }
  };

  const buttonLabel = installPrompt
    ? "앱 설치"
    : ios
      ? "홈 화면에 추가"
      : samsungInternet
        ? "앱 설치 방법"
        : "앱 설치";

  return (
    <>
      <button
        type="button"
        onClick={() => void requestInstall()}
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100 active:scale-[0.98]"
        aria-label="수행평가 도우미 앱 설치"
      >
        {buttonLabel}
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
                  : "수행평가 도우미 설치"}
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
                  삼성 인터넷의 기본 설치 표시를 웹페이지가 막지 않도록 수정했습니다. 주소창의 설치 아이콘 또는 브라우저 메뉴의 설치 항목을 사용하세요.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>페이지를 한 번 새로고침합니다.</li>
                  <li>주소창에 설치 아이콘이 나타나는지 확인합니다.</li>
                  <li>없으면 삼성 인터넷 <strong>메뉴</strong>에서 <strong>현재 페이지 추가</strong> 또는 <strong>앱 설치</strong>를 확인합니다.</li>
                  <li>가능하면 <strong>앱스 화면</strong> 설치를 선택합니다.</li>
                </ol>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  브라우저가 아직 설치 이벤트를 보내지 않았습니다. 페이지를 새로고침한 뒤 다시 시도하거나 브라우저 메뉴의 <strong>앱 설치</strong> 또는 <strong>홈 화면에 추가</strong>를 선택하세요.
                </p>
                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  설치 항목 자체가 보이지 않으면 <strong>/pwa-debug</strong>에서 Manifest와 Service Worker 상태를 확인할 수 있습니다.
                </div>
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
