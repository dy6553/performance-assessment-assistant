"use client";

import { useEffect, useState } from "react";

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
  const [installed, setInstalled] = useState(false);
  const [samsungInternet, setSamsungInternet] = useState(false);
  const [ios, setIos] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setSamsungInternet(isSamsungInternet());
    setIos(isIos());

    const onInstalled = () => {
      setInstalled(true);
      setHelpOpen(false);
    };

    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  if (installed) return null;

  const buttonLabel = ios ? "홈 화면에 추가" : "앱 설치";

  return (
    <>
      <button
        type="button"
        onClick={() => setHelpOpen(true)}
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
                  웹페이지에서 설치 이벤트를 가로채지 않고 삼성 인터넷의 기본 PWA 설치 기능을 그대로 사용하도록 변경했습니다.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>브라우저 <strong>메뉴</strong>를 엽니다.</li>
                  <li><strong>현재 페이지 추가</strong>를 선택합니다.</li>
                  <li><strong>앱스 화면</strong> 또는 <strong>앱 설치</strong>가 보이면 선택합니다.</li>
                </ol>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Chrome의 기본 설치 기능을 사용합니다. 브라우저가 PWA 설치 가능 상태로 판정하면 설치 항목이 표시됩니다.
                </p>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  <li>Chrome 오른쪽 위 <strong>⋮ 메뉴</strong>를 엽니다.</li>
                  <li><strong>홈 화면에 추가</strong> 또는 <strong>설치 및 바로가기</strong>를 선택합니다.</li>
                  <li><strong>앱 설치</strong>가 나타나면 선택합니다.</li>
                </ol>
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
