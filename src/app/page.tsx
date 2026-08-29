import { InstallAppButton } from "@/components/install-app-button";
import { AssessmentClient } from "@/features/assessment/assessment-client";
import { AssessmentQuickTools } from "@/features/assessment/assessment-quick-tools";

export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 rounded-[2rem] bg-gradient-to-br from-violet-600 to-sky-500 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black text-white/75">수행평가 AI</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-5xl">과제 정보를 입력하세요</h1>
          </div>
          <InstallAppButton />
        </div>
      </header>

      <div className="space-y-8">
        <AssessmentQuickTools />
        <AssessmentClient />
      </div>
    </main>
  );
}
