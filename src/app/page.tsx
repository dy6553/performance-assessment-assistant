import Link from "next/link";
import { InstallAppButton } from "@/components/install-app-button";

const actions = [
  { href: "/create", title: "수행평가 만들기", description: "유형을 고르고 과제 조건부터 차근차근 입력합니다.", mark: "01" },
  { href: "/topic-recommender", title: "AI 주제 추천", description: "과목과 관심사를 바탕으로 주제를 찾아봅니다.", mark: "02" },
  { href: "/assignment/setup/auto", title: "과제 안내 분석", description: "안내문과 평가 기준을 읽고 작성 방향을 잡습니다.", mark: "03" },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-12">
      <section className="rounded-[1.75rem] border border-violet-100 bg-violet-50/70 p-5 sm:p-9">
        <p className="text-sm font-bold text-violet-700">수행평가 도우미</p>
        <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">과제 조건부터 완성까지,<br />한 단계씩 진행하세요.</h1>
        <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">유형을 선택하고 안내문을 확인한 뒤 주제와 초안을 만들어 보세요.</p>
        <Link className="mt-6 inline-flex min-h-12 items-center rounded-2xl bg-violet-700 px-5 font-bold text-white hover:bg-violet-800" href="/create">새 수행평가 시작 <span className="ml-3" aria-hidden="true">→</span></Link>
      </section>
      <section aria-labelledby="start-title" className="mt-8">
        <h2 id="start-title" className="text-xl font-black text-slate-950">어떻게 시작할까요?</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className="group flex min-h-36 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-violet-300 hover:bg-violet-50/40">
              <span className="text-xs font-black text-violet-600">{action.mark}</span>
              <h3 className="mt-3 text-lg font-black text-slate-950">{action.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </section>
      <section aria-label="다른 도구" className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-slate-200 pt-5 text-sm font-semibold text-slate-600">
        <Link href="/assignment/history" className="hover:text-violet-700">최근 작업</Link>
        <Link href="/calendar" className="hover:text-violet-700">캘린더</Link>
        <Link href="/ai-tools" className="hover:text-violet-700">AI 도구</Link>
        <InstallAppButton />
      </section>
    </main>
  );
}
