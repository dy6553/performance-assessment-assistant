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

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

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
        {installPrompt ? "앱 설치 가능" : "앱 설치"}
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
              실제 앱으로 설치하기
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              지금은 브라우저가 네이티브 PWA 설치 이벤트를 아직 제공하지 않고 있습니다.
            </p>
            <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <strong>중요:</strong> 메뉴의 <strong>홈 화면에 추가</strong>만 사용하면 Chrome 배지가 붙은 웹 바로가기가 만들어질 수 있습니다. 시험온처럼 설치하려면 <strong>앱 설치</strong> 또는 이 버튼이 <strong>앱 설치 가능</strong>으로 바뀐 뒤 설치해 주세요.
            </div>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li>현재 홈 화면의 <strong>수행도우미</strong> 바로가기를 삭제합니다.</li>
              <li>이 사이트를 브라우저에서 다시 열고 잠시 사용합니다.</li>
              <li>이 버튼이 <strong>앱 설치 가능</strong>으로 바뀌면 눌러 설치합니다.</li>
              <li>브라우저 메뉴에 <strong>앱 설치</strong>가 별도로 보이면 그 메뉴를 사용해도 됩니다.</li>
            </ol>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              실제 PWA 앱으로 설치되면 브라우저 배지 없이 앱 서랍에 별도 앱으로 표시됩니다.
            </p>
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
