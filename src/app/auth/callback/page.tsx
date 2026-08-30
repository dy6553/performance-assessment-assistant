"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("이메일 인증을 확인하고 로그인 상태를 연결하고 있습니다.");

  useEffect(() => {
    let cancelled = false;

    async function finishConfirmation() {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const errorDescription = params.get("error_description");
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = Number(params.get("expires_in") ?? 3600);

      if (errorDescription) {
        if (!cancelled) {
          setStatus("error");
          setMessage(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
        }
        return;
      }

      if (!accessToken || !refreshToken) {
        if (!cancelled) {
          setStatus("error");
          setMessage("인증 정보가 없습니다. 인증 메일의 링크를 다시 열어 주세요.");
        }
        return;
      }

      try {
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken, refreshToken, expiresIn }),
        });

        if (!response.ok) throw new Error("SESSION_SETUP_FAILED");

        window.history.replaceState({}, "", "/auth/callback");
        window.location.replace("/account?verified=1");
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("인증은 되었지만 로그인 상태를 연결하지 못했습니다. 로그인 화면에서 다시 로그인해 주세요.");
        }
      }
    }

    void finishConfirmation();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-black text-violet-700">이메일 인증</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">
          {status === "loading" ? "계정을 확인하고 있습니다" : "인증을 마무리하지 못했습니다"}
        </h1>
        <p className="mt-4 text-sm font-semibold leading-7 text-slate-600">{message}</p>
        {status === "loading" ? (
          <div className="mx-auto mt-6 size-8 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />
        ) : (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-violet-600 px-5 font-black text-white" href="/login">
              로그인하기
            </Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-5 font-black text-slate-700" href="/">
              홈으로
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
