"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <p className="text-sm font-black text-rose-700">화면 오류</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">화면을 불러오지 못했습니다</h1>
        <button className="mt-6 min-h-12 rounded-2xl bg-slate-950 px-5 font-black text-white" onClick={reset} type="button">다시 시도</button>
      </section>
    </main>
  );
}
