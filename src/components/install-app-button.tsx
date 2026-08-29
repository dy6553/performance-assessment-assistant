"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const syncInstalled = () => setInstalled(isStandalone());
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
      setHelpOpen(false);
    };

    queueMicrotask(syncInstalled);
    displayMode.addEventListener("change", syncInstalled);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      displayMode.removeEventListener("change", syncInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  const install = async () => {
    if (!prompt) {
      setHelpOpen(true);
      return;
    }

    await prompt.prompt();
    const choice = await prompt.userChoice;
    setPrompt(null);
    if (choice.outcome === "dismissed") setHelpOpen(true);
  };

  return (
    <>
      <button
        aria-label="수행평가 도우미 앱 설치"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-xl shadow-violet-950/25 transition hover:bg-violet-700 active:scale-[0.98] sm:static sm:min-h-11 sm:rounded-xl sm:px-4 sm:py-2.5 sm:shadow-sm"
        onClick={() => void install()}
        type="button"
      >
        <span aria-hidden="true">↓</span>
        앱 설치
      </button>

      {helpOpen ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4"
          onClick={() => setHelpOpen(false)}
          role="presentation"
        >
          <section
            aria-labelledby="install-help-title"
            aria-modal="true"
            className="w-full max-w-sm rounded-[2rem] bg-white p-6 text-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-100 text-3xl">📱</div>
            <h2 className="mt-4 text-center text-xl font-black" id="install-help-title">
              갤럭시에 앱 설치하기
            </h2>
            <ol className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li><strong>1.</strong> 이 페이지를 <strong>삼성 인터넷</strong>에서 엽니다.</li>
              <li><strong>2.</strong> 오른쪽 아래 <strong>☰ 메뉴</strong>를 누릅니다.</li>
              <li><strong>3.</strong> <strong>현재 페이지 추가 → 홈 화면</strong>을 선택합니다.</li>
              <li><strong>4.</strong> 표시되는 창에서 <strong>설치</strong>를 누릅니다.</li>
            </ol>
            <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              카카오톡·네이버 앱 안에서 열었다면 먼저 메뉴에서 ‘다른 브라우저로 열기’를 선택해 주세요.
            </p>
            <button
              className="mt-5 min-h-12 w-full rounded-2xl bg-violet-600 px-4 font-black text-white"
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
