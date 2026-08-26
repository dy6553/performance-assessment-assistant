export const dynamic = "force-static";

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#7c3aed" />
  <title>PWA 최소 테스트</title>
  <link rel="manifest" href="/pwa-control/manifest.webmanifest" />
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f8fafc; color: #0f172a; }
    main { max-width: 680px; margin: 0 auto; padding: 28px 18px 48px; }
    .card { margin-top: 16px; padding: 16px; border: 1px solid #ddd6fe; border-radius: 18px; background: white; }
    h1 { margin: 0; font-size: 28px; }
    p { line-height: 1.65; }
    button { min-height: 46px; border: 0; border-radius: 14px; padding: 0 18px; font-weight: 800; font-size: 15px; }
    #install { background: #7c3aed; color: white; }
    #reload { background: #ede9fe; color: #5b21b6; margin-left: 8px; }
    #install[hidden] { display: none; }
    .ok { color: #047857; font-weight: 800; }
    .wait { color: #92400e; font-weight: 800; }
    pre { white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.55; background: #f8fafc; padding: 12px; border-radius: 12px; }
  </style>
</head>
<body>
<main>
  <h1>PWA 최소 통제 테스트</h1>
  <p>메인 수행평가 도우미와 분리된 Manifest·Service Worker 범위에서 Samsung Internet의 설치 판정을 확인합니다.</p>

  <div class="card">
    <p><strong>현재 상태:</strong> <span id="status" class="wait">초기화 중</span></p>
    <button id="install" type="button" hidden>앱 설치</button>
    <button id="reload" type="button">새로고침</button>
  </div>

  <div class="card">
    <strong>진단 로그</strong>
    <pre id="log"></pre>
  </div>
</main>
<script>
(function () {
  var installEvent = null;
  var status = document.getElementById("status");
  var installButton = document.getElementById("install");
  var logBox = document.getElementById("log");
  var reloadButton = document.getElementById("reload");

  function log(message) {
    var line = new Date().toISOString() + "  " + message;
    logBox.textContent += (logBox.textContent ? "\n" : "") + line;
  }

  function setStatus(message, ok) {
    status.textContent = message;
    status.className = ok ? "ok" : "wait";
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    log("beforeinstallprompt 발생 · prompt=" + (typeof event.prompt === "function") + " · defaultPrevented=" + event.defaultPrevented);
    event.preventDefault();
    installEvent = event;
    installButton.hidden = false;
    setStatus("beforeinstallprompt 발생 확인", true);
  });

  window.addEventListener("appinstalled", function () {
    log("appinstalled 발생");
    installEvent = null;
    installButton.hidden = true;
    setStatus("설치 완료", true);
  });

  installButton.addEventListener("click", async function () {
    if (!installEvent || typeof installEvent.prompt !== "function") {
      log("설치 버튼 클릭 · 저장된 설치 이벤트 없음");
      return;
    }
    log("설치 버튼 클릭 · prompt() 호출");
    await installEvent.prompt();
    if (installEvent.userChoice) {
      var choice = await installEvent.userChoice;
      log("userChoice · outcome=" + choice.outcome);
    }
    installEvent = null;
  });

  reloadButton.addEventListener("click", function () {
    location.reload();
  });

  if (matchMedia("(display-mode: standalone)").matches) {
    log("display-mode: standalone");
    setStatus("standalone 실행 중", true);
  } else {
    log("display-mode: browser");
  }

  log("UA · " + navigator.userAgent);
  log("origin · " + location.origin);
  log("manifest · /pwa-control/manifest.webmanifest");

  if (!("serviceWorker" in navigator)) {
    log("Service Worker 미지원");
    setStatus("Service Worker 미지원", false);
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    log("controllerchange · " + (navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : "none"));
  });

  window.addEventListener("load", async function () {
    try {
      log("Service Worker 등록 시작 · /pwa-control/sw.js · scope=/pwa-control/");
      var registration = await navigator.serviceWorker.register("/pwa-control/sw.js", {
        scope: "/pwa-control/",
        updateViaCache: "none"
      });
      log("Service Worker 등록 성공 · scope=" + registration.scope);
      await registration.update();
      var ready = await navigator.serviceWorker.ready;
      log("Service Worker ready · scope=" + ready.scope);
      log("controller · " + (navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : "none"));
      if (!installEvent && !matchMedia("(display-mode: standalone)").matches) {
        setStatus("설치 이벤트 대기 중 — 화면을 한 번 탭하고 40초 이상 유지", false);
      }
    } catch (error) {
      log("Service Worker 등록 실패 · " + (error && error.message ? error.message : String(error)));
      setStatus("Service Worker 등록 실패", false);
    }
  });
})();
</script>
</body>
</html>`;

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
