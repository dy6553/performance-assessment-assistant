import Link from "next/link";

import { InstallAppButton } from "@/components/install-app-button";
import { assignmentTypeOptions } from "@/features/assessment/assessment-flow";

const cardClass = {
  auto: "from-violet-50 to-fuchsia-50/70 border-violet-100",
  report: "from-emerald-50 to-teal-50/70 border-emerald-100",
  presentation: "from-sky-50 to-cyan-50/70 border-sky-100",
  experiment: "from-amber-50 to-orange-50/70 border-amber-100",
} as const;

const badgeClass = {
  auto: "bg-violet-100 text-violet-700",
  report: "bg-emerald-100 text-emerald-700",
  presentation: "bg-sky-100 text-sky-700",
  experiment: "bg-amber-100 text-amber-800",
} as const;

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="rounded-[2rem] bg-gradient-to-br from-violet-600 via-fuchsia-500 to-sky-500 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black text-white/75">수행평가 AI</p>
            <h1 className="mt-3 text-3xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">
              어떤 수행평가를
              <br />
              준비하시나요?
            </h1>
            <p className="mt-4 max-w-xl text-sm font-bold leading-6 text-white/80 sm:text-base">
              시험온처럼 한 단계씩 진행합니다. 유형을 고르면 기본 정보 → 주제 선택 → 최종 확인 순서로 다음 페이지로 이동합니다.
            </p>
          </div>
          <InstallAppButton />
        </div>
      </header>

      <section className="mt-7" aria-labelledby="assignment-type-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">STEP 1</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-slate-950" id="assignment-type-title">
              수행평가 유형 선택
            </h2>
          </div>
          <p className="text-sm font-bold text-slate-400">카드를 누르면 다음 페이지로 이동합니다.</p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assignmentTypeOptions.map((item) => (
            <Link
              className={`group min-h-56 rounded-[2rem] border bg-gradient-to-br p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.99] ${cardClass[item.slug]}`}
              href={`/assignment/setup/${item.slug}`}
              key={item.slug}
              prefetch
            >
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${badgeClass[item.slug]}`}>
                {item.eyebrow}
              </span>
              <h3 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{item.description}</p>
              <div className="mt-6 flex items-center justify-between text-sm font-black text-slate-700">
                <span>시작하기</span>
                <span className="text-lg text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-label="진행 순서">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">진행 순서</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            ["1", "유형 선택", "탐구보고서·발표·실험 등"],
            ["2", "과제 정보", "과목·학년·교사 안내"],
            ["3", "주제 선택", "직접 입력 또는 AI 추천"],
            ["4", "작성·검증", "전략 → 초안 → 검증"],
          ].map(([number, title, description]) => (
            <div className="rounded-2xl bg-slate-50 p-4" key={number}>
              <span className="grid size-8 place-items-center rounded-full bg-slate-950 text-xs font-black text-white">{number}</span>
              <h3 className="mt-3 font-black text-slate-900">{title}</h3>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
