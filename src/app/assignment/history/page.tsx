import { AssignmentHistory } from "@/features/assessment/assignment-history";

export const metadata = {
  title: "최근 작업 기록",
};

export default function AssignmentHistoryPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-6 rounded-[2rem] border border-violet-100 bg-gradient-to-br from-violet-50 to-sky-50 p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">24시간 작업 기록</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">진행 중인 작업과 최근 결과</h1>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-6 text-slate-600">
          과제 분석·초안 작성·독립 검증은 앱 화면을 벗어나도 서비스 워커가 가능한 범위에서 처리를 이어가며, 요청과 결과는 이 기기에 최대 24시간만 보관됩니다. 24시간이 지나면 자동으로 삭제됩니다.
        </p>
      </div>
      <AssignmentHistory />
    </main>
  );
}
