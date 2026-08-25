import { AssessmentClient } from "@/features/assessment/assessment-client";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-700">wanhee</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">NVIDIA AI Router</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">교육과정·루브릭 기반</span>
        </div>
        <h1 className="mt-5 max-w-4xl text-4xl font-black leading-[1.08] tracking-[-0.055em] text-slate-950 sm:text-6xl">
          수행평가를 쓰기 전에
          <br />
          <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-500 bg-clip-text text-transparent">평가 기준부터 이해합니다.</span>
        </h1>
        <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          교사 안내문과 루브릭을 먼저 분석하고, 작성 전략을 확인한 뒤 초안을 만듭니다. 마지막에는 요구조건·교육과정·논리·사실/출처를 별도 단계에서 다시 검사합니다.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Feature title="전략 먼저" description="바로 본문을 생성하지 않고 평가요소와 구조를 먼저 정리합니다." />
          <Feature title="근거 표시" description="판정마다 초안의 실제 위치나 확인이 필요한 이유를 보여줍니다." />
          <Feature title="환각 억제" description="공식 확인 전 성취기준 코드나 최신 통계를 임의로 확정하지 않습니다." />
        </div>
      </header>

      <AssessmentClient />

      <footer className="py-10 text-center text-xs leading-5 text-slate-400">
        제출 준비도는 학교 성적 예측이 아니라 내부 품질검사 지표입니다. 실제 교사 안내문과 학교 지침이 항상 우선합니다.
      </footer>
    </main>
  );
}

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="font-black text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
