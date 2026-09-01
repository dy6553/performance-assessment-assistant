import Link from "next/link";

const inquiryTypes = [
  {
    href: "/assignment/setup/experiment",
    title: "실험 탐구",
    description: "가설과 변인을 설정하고 반복 측정, 오차, 안전을 점검하는 재현 가능한 실험 탐구를 준비합니다.",
    points: ["가설·변인·대조 조건 설계", "반복 측정과 원자료 기록", "오차·안전·재현성 검토"],
  },
  {
    href: "/assignment/setup/real-life-inquiry",
    title: "실생활 적용 탐구",
    description: "교과 개념을 학교·가정·지역사회의 실제 문제에 적용하고 효과를 측정하는 문제 해결형 탐구입니다.",
    points: ["실제 문제와 사용자 정의", "해결안 비교와 실행 설계", "적용 전후 효과 측정"],
  },
] as const;

export default function InquiryTypePage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">탐구</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">탐구 유형을 선택하세요</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          실험으로 검증하는 탐구와 실제 문제에 적용하는 탐구는 설계 기준이 달라 각각 전용 AI 프롬프트로 진행합니다.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {inquiryTypes.map((type) => (
            <Link
              className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/60 hover:shadow-md active:scale-[0.99]"
              href={type.href}
              key={type.href}
              prefetch
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-700">탐구형</span>
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
