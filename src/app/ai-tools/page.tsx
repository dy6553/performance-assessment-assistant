import Link from "next/link";

const tools = [
  {
    href: "/assignment/setup/auto",
    eyebrow: "AI 분류",
    title: "AI 자동 분석",
    description: "교사 안내문과 과제 조건을 바탕으로 수행평가 유형과 작성 전략을 먼저 분석합니다.",
    className: "from-violet-50 to-fuchsia-50/70 border-violet-100",
    badgeClassName: "bg-violet-100 text-violet-700",
  },
  {
    href: "/topic-recommender",
    eyebrow: "AI 추천",
    title: "AI 주제 추천",
    description: "교육과정, 학년, 과목과 수행평가 유형을 기준으로 여러 수행평가 주제를 추천합니다.",
    className: "from-sky-50 to-cyan-50/70 border-sky-100",
    badgeClassName: "bg-sky-100 text-sky-700",
  },
] as const;

export default function AiToolsPage() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <header>
        <p className="text-sm font-black text-violet-700">AI</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">AI 도구</h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600 sm:text-base">
          시험온의 주요 창처럼 AI 기능을 별도 화면으로 분리했습니다. 필요한 기능을 선택하면 해당 작업 화면으로 이동합니다.
        </p>
      </header>

      <section className="mt-7 grid gap-4 sm:grid-cols-2" aria-label="AI 기능">
        {tools.map((tool) => (
          <Link
            className={`group min-h-64 rounded-[2rem] border bg-gradient-to-br p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.99] ${tool.className}`}
            href={tool.href}
            key={tool.href}
            prefetch
          >
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tool.badgeClassName}`}>{tool.eyebrow}</span>
            <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-950">{tool.title}</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{tool.description}</p>
            <div className="mt-8 flex items-center justify-between font-black text-slate-700">
              <span>열기</span>
              <span className="text-xl text-slate-300 transition group-hover:translate-x-1 group-hover:text-violet-600" aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
