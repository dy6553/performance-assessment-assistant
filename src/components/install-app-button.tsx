"use client";

import { useEffect, useState } from "react";

interface InstallChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<InstallChoice | void>;
  userChoice: Promise<InstallChoice>;
}

function isStandalone() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    if (!installPrompt) {
      setHelpOpen(true);
      return;
    }

    const promptResult = await installPrompt.prompt();
    const choice = promptResult ?? (await installPrompt.userChoice);
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setHelpOpen(false);
  };

  return (
    <>
      <button
        aria-label="수행평가 도우미 앱 설치"
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
        onClick={() => void handleInstall()}
        type="button"
      >
        앱 설치
      </button>

      {helpOpen ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4"
          onClick={() => setHelpOpen(false)}
          role="presentation"
        >
          <section
            aria-labelledby="install-help-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-[2rem] border border-violet-100 bg-white p-6 text-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <h2 className="text-xl font-black" id="install-help-title">
              수행평가 도우미 설치하기
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              삼성 인터넷의 오른쪽 아래 메뉴에서 <strong>현재 페이지 추가</strong>를 누른 다음
              설치 가능한 앱 항목을 선택해 주세요.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              설치 메뉴가 보이지 않으면 페이지를 새로고침한 뒤 다시 눌러 주세요.
            </p>
            <button
              className="mt-5 min-h-12 w-full rounded-2xl bg-violet-600 px-4 font-black text-white transition hover:bg-violet-700 active:scale-[0.98]"
              onClick={() => setHelpOpen(false)}
              type="button"
            >
              확인
            </button>
          </section>
        </div>
      ) : null}
    </>
  );
}
