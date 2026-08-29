import Link from "next/link";

import { InstallAppButton } from "@/components/install-app-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-center gap-3">
        <Link className="grid size-11 place-items-center rounded-2xl border border-slate-200 bg-white text-xl" href="/" aria-label="홈으로">←</Link>
        <h1 className="text-3xl font-black tracking-[-0.04em]">설정</h1>
      </div>

      <div className="space-y-4">
        <section className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div><p className="text-sm font-black text-violet-700">화면 테마</p><h2 className="mt-1 text-lg font-black">라이트·다크 모드</h2></div>
          <ThemeToggle />
        </section>

        <section className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div><p className="text-sm font-black text-violet-700">갤럭시</p><h2 className="mt-1 text-lg font-black">앱으로 설치</h2></div>
          <InstallAppButton />
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">데이터</h2>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">입력 내용</dt><dd className="font-black">기기에 저장 안 함</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">AI 처리</dt><dd className="font-black">NVIDIA API</dd></div>
            <div className="flex justify-between gap-4 py-3"><dt className="text-slate-500">앱 버전</dt><dd className="font-black">1.0</dd></div>
          </dl>
        </section>
      </div>
    </main>
  );
}
