import Link from "next/link";

import { InstallAppButton } from "@/components/install-app-button";

const sections = [
  {
    eyebrow: "AI 도구",
    title: "AI로 빠르게 시작",
    description: "과제 안내를 분석하거나 수행평가 주제를 먼저 추천받을 수 있습니다.",
    accent: "violet",
    items: [
      {
        href: "/assignment/setup/auto",
        title: "AI 자동 분석",
        description: "안내문을 바탕으로 수행평가 유형과 작성 전략을 먼저 판단합니다.",
        badge: "AI 분류",
      },
      {
        href: "/topic-recommender",
        title: "AI 주제 추천",
        description: "과목·학년·수행평가 유형에 맞는 주제를 새로 추천받습니다.",
        badge: "새 기능",
      },
    ],
  },
  {
    eyebrow: "수행평가 만들기",
    title: "유형별로 바로 시작",
    description: "과제 형태가 정해져 있다면 필요한 유형을 바로 선택하세요.",
    accent: "emerald",
    items: [
      {
        href: "/assignment/setup/report",
        title: "탐구·보고서",
        description: "탐구보고서, 조사보고서, 논술형 보고서를 단계별로 준비합니다.",
        badge: "보고서형",
      },
      {
        href: "/assignment/setup/presentation",
        title: "발표·토론",
        description: "발표문, 발표 자료, 토론 주장과 근거를 과제 조건에 맞춰 설계합니다.",
        badge: "발표형",
      },
      {
        href: "/assignment/setup/experiment",
        title: "실험·탐구",
        description: "가설, 변인, 관찰, 실험 과정과 결과 해석이 필요한 과제를 준비합니다.",
        badge: "탐구형",
      },
    ],
  },
] as const;

const sectionClass = {
  violet: "from-violet-50/90 to-fuchsia-50/60 border-violet-100",
  emerald: "from-emerald-50/90 to-teal-50/60 border-emerald-100",
} as const;

const eyebrowClass = {
  violet: "bg-violet-100/80 text-violet-700",
  emerald: "bg-emerald-100/80 text-emerald-700",
} as const;

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <section className="pt-2 sm:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="inline-flex rounded-full bg-violet-100/80 px-3 py-1.5 text-sm font-extrabold text-violet-700">
              수행평가 도우미
            </p>
            <h1 className="mt-4 text-[2.35rem] font-black leading-[1.13] tracking-[-0.045em] text-slate-950 sm:text-5xl">
              필요한 수행평가 도구를
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 bg-clip-text text-transparent">
                바로 시작해 보세요
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-600 sm:text-lg">
              시험온처럼 기능을 카테고리로 나눴습니다. 각 카테고리 안의 버튼을 눌러 필요한 작업으로 바로 이동합니다.
            </p>
          </div>
          <InstallAppButton />
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2" aria-label="수행평가 주요 기능">
        {sections.map((section) => (
          <article
            className={`rounded-[2rem] border bg-gradient-to-br p-5 shadow-lg shadow-slate-100/70 sm:p-6 ${sectionClass[section.accent]}`}
            key={section.title}
          >
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${eyebrowClass[section.accent]}`}>
              {section.eyebrow}
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-[-0.025em] text-slate-950">{section.title}</h2>
            <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-500">{section.description}</p>

            <div className="mt-5 grid gap-3">
              {section.items.map((item) => (
                <Link
                  className="group rounded-2xl border border-white/90 bg-white/85 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-white hover:shadow-md active:scale-[0.99]"
                  href={item.href}
                  key={item.title}
                  prefetch
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-slate-900 group-hover:text-violet-700">{item.title}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                          {item.badge}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{item.description}</p>
                    </div>
                    <span
                      className="mt-0.5 shrink-0 text-lg font-black text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500"
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white/80 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black text-slate-900">처음이라면 AI 주제 추천부터 시작해도 됩니다.</p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-500">
              과목과 수행평가 유형만 정하면 여러 주제를 추천하고, 선택한 주제로 바로 수행평가 작성 화면을 이어갈 수 있습니다.
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 shrink-0 items-center rounded-2xl bg-violet-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-violet-700 active:scale-[0.98]"
            href="/topic-recommender"
            prefetch
          >
            AI 주제 추천 받기
          </Link>
        </div>
      </section>
    </main>
  );
}
