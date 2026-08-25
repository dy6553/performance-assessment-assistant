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

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [samsungInternet, setSamsungInternet] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setSamsungInternet(isSamsungInternet());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
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

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setHelpOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void requestInstall()}
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100 active:scale-[0.98]"
        aria-label="수행평가 도우미 앱 설치"
      >
        {installPrompt ? "앱 화면에 설치" : "앱 설치"}
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
              {samsungInternet ? "삼성 인터넷에서 앱 설치" : "실제 앱으로 설치하기"}
            </h2>

            {samsungInternet ? (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  삼성 인터넷이 아직 PWA 설치 버튼을 제공하지 않은 상태입니다. 설치 가능 판정이 나면 이 버튼이 <strong>앱 화면에 설치</strong>로 바뀌고 삼성 인터넷의 설치 창이 열립니다.
                </p>
                <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-950">
                  시험온처럼 설치하려면 삼성 인터넷 상단에 설치 아이콘이 나타났을 때 눌러 <strong>앱 화면에 설치</strong>를 선택하세요.
                </div>
                <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <strong>홈 화면 바로가기</strong>로 추가하는 방식은 사용하지 마세요. 브라우저 배지가 붙은 바로가기가 될 수 있습니다.
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                브라우저가 아직 네이티브 PWA 설치 이벤트를 제공하지 않고 있습니다. 설치 가능한 상태가 되면 이 버튼에서 시스템 설치창을 열 수 있습니다.
              </p>
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
