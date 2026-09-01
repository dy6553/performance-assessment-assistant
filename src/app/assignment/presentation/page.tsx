import Link from "next/link";

const presentationTypes = [
  {
    href: "/assignment/setup/presentation",
    title: "실제 발표",
    description: "슬라이드뿐 아니라 발표 대본, 시간 배분, 전달 방식, 질의응답까지 실제 발표 상황에 맞춰 준비합니다.",
    points: ["발표 흐름과 핵심 메시지", "슬라이드와 대본 분리", "질의응답·리허설 준비"],
  },
  {
    href: "/assignment/setup/visual-material",
    title: "비발표 자료",
    description: "PPT·카드뉴스·포스터·인포그래픽처럼 말로 설명하지 않고 자료만 제출하는 수행평가를 준비합니다.",
    points: ["자료만 읽어도 이해되는 구성", "페이지별 핵심 메시지", "가독성·출처·시각화 점검"],
  },
] as const;

export default function PresentationTypePage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">발표</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">발표 유형을 선택하세요</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          실제로 말하는 발표와 자료만 제출하는 수행평가는 준비 방식이 달라 각각 전용 AI 프롬프트로 진행합니다.
        </p>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          {presentationTypes.map((type) => (
            <Link
              className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50/60 hover:shadow-md active:scale-[0.99]"
              href={type.href}
              key={type.href}
              prefetch
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-black text-violet-700">발표형</span>
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
