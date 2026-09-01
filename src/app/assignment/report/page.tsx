import Link from "next/link";

const reportTypes = [
  {
    href: "/assignment/setup/research-report",
    title: "조사보고서",
    description: "기사, 논문, 공공자료 등 여러 출처를 조사하고 비교·정리해 근거 중심의 보고서를 작성합니다.",
    points: ["자료 조사와 출처 정리", "핵심 내용 비교·분석", "근거 중심 결론 작성"],
  },
  {
    href: "/assignment/setup/inquiry-report",
    title: "탐구보고서",
    description: "탐구 문제를 정하고 과정과 결과를 분석해 문제–과정–분석–결론 구조의 보고서를 작성합니다.",
    points: ["탐구 문제와 목적 설정", "탐구 과정·자료 분석", "결론과 한계 정리"],
  },
] as const;

export default function ReportTypePage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">보고서</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">작성할 보고서 유형을 선택하세요</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          조사보고서와 탐구보고서는 작성 목적과 구조가 달라서 각각에 맞는 작성 전략으로 진행합니다.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {reportTypes.map((type) => (
            <Link
              className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/60 hover:shadow-md active:scale-[0.99]"
              href={type.href}
              key={type.href}
              prefetch
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-700">보고서형</span>
                  <h2 className="mt-3 text-2xl font-black text-slate-950 group-hover:text-violet-700">{type.title}</h2>
                </div>
                <span className="text-2xl font-black text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-500" aria-hidden="true">→</span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{type.description}</p>
              <ul className="mt-4 space-y-2 text-sm font-bold text-slate-500">
                {type.points.map((point) => (
                  <li className="flex items-center gap-2" key={point}>
                    <span className="size-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
