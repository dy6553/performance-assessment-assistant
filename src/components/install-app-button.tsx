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

    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
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

  const handleInstallClick = async () => {
    if (ios || !installPrompt) {
      setHelpOpen(true);
      return;
    }

    try {
      setPrompting(true);
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);

      if (choice.outcome === "accepted") {
        setHelpOpen(false);
      }
    } catch {
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
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
        aria-label="수행평가 도우미 앱 설치"
      >
        {prompting ? "설치창 여는 중…" : ios ? "홈 화면에 추가" : "앱 설치"}
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
                  : "브라우저에서 설치"}
            </h2>

            {ios ? (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                <li>Safari의 <strong>공유</strong> 버튼을 누릅니다.</li>
                <li><strong>홈 화면에 추가</strong>를 선택합니다.</li>
                <li>오른쪽 위 <strong>추가</strong>를 눌러 완료합니다.</li>
              </ol>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  브라우저가 아직 설치 가능 이벤트를 보내지 않았습니다.
                </p>
                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  시험온과 같은 방식으로 Service Worker 등록 뒤 설치 이벤트를 기다립니다. 이벤트가 준비되면 이 <strong>앱 설치</strong> 버튼이 실제 설치 확인창을 엽니다.
                </p>
                {samsungInternet ? (
                  <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                    <li>페이지를 완전히 닫았다가 다시 엽니다.</li>
                    <li>주소창의 설치 아이콘 또는 이 버튼을 다시 확인합니다.</li>
                    <li>설치 아이콘이 보이면 <strong>앱스 화면에 설치</strong>를 선택합니다.</li>
                  </ol>
                ) : (
                  <p className="mt-4 text-sm leading-6 text-slate-700">
                    브라우저 메뉴의 <strong>앱 설치</strong> 항목도 함께 확인할 수 있습니다.
                  </p>
                )}
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
