import Link from "next/link";

import { Icon, type IconName } from "@/components/icons";

const createOptions: Array<{
  href: string;
  icon: IconName;
  eyebrow: string;
  title: string;
  description: string;
  className: string;
  badgeClassName: string;
}> = [
  {
    href: "/assignment/report",
    icon: "document",
    eyebrow: "문서형 수행평가",
    title: "보고서",
    description: "조사·탐구 내용을 구조화해 보고서 초안부터 완성본까지 작성합니다.",
    className: "from-violet-50 to-fuchsia-50/70 border-violet-100",
    badgeClassName: "bg-violet-100 text-violet-700",
  },
  {
    href: "/assignment/presentation",
    icon: "presentation",
    eyebrow: "발표형 수행평가",
    title: "발표",
    description: "발표 자료 구성, 내용 정리, 발표 준비를 단계별로 진행합니다.",
    className: "from-sky-50 to-cyan-50/70 border-sky-100",
    badgeClassName: "bg-sky-100 text-sky-700",
  },
  {
    href: "/assignment/inquiry",
    icon: "flask",
    eyebrow: "탐구형 수행평가",
    title: "탐구",
    description: "실험·생활 탐구 등 탐구 과정을 계획하고 결과물까지 이어서 작성합니다.",
    className: "from-emerald-50 to-teal-50/70 border-emerald-100",
    badgeClassName: "bg-emerald-100 text-emerald-700",
  },
];

export default function CreatePage() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header>
        <p className="text-sm font-black text-violet-700">만들기</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">수행평가 만들기</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">
          원하는 수행평가 종류를 선택하면 해당 작업 화면으로 이동합니다.
        </p>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="수행평가 종류">
        {createOptions.map((option) => (
          <Link
            className={`group min-h-56 rounded-[2rem] border bg-gradient-to-br p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.99] ${option.className}`}
            href={option.href}
            key={option.href}
            prefetch
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${option.badgeClassName}`}>{option.eyebrow}</span>
              <span className="grid size-10 place-items-center rounded-2xl bg-white/80 text-slate-600 shadow-sm">
                <Icon className="size-5" name={option.icon} />
              </span>
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-950">{option.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{option.description}</p>
            <div className="mt-7 flex items-center justify-between font-black text-slate-700">
              <span>열기</span>
              <span className="text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600" aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
