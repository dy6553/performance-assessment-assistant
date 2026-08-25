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

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as NavigatorWithStandalone).standalone);

    setInstalled(standalone);

    const onBeforeInstallPrompt = (event: Event) => {
      // Do not preventDefault here. Samsung Internet/Chromium may still decide
      // to expose its own address-bar install affordance. We only retain the
      // event so the page can offer an additional native-install entry point.
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setMessage(null);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setMessage(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (installed) {
    return null;
  }

  const requestInstall = async () => {
    if (!installPrompt) {
      setMessage("브라우저가 아직 설치 가능 여부를 갱신 중입니다. 탭을 완전히 닫았다가 다시 열어 주세요.");
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setMessage("설치를 시작했습니다.");
      }
      setInstallPrompt(null);
    } catch {
      setMessage("브라우저의 앱 설치 메뉴를 사용해 주세요.");
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={requestInstall}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2 text-xs font-black text-violet-700 transition hover:bg-violet-100"
      >
        앱 설치
      </button>
      {message ? <p className="max-w-64 text-right text-[11px] leading-4 text-slate-500">{message}</p> : null}
    </div>
  );
}
