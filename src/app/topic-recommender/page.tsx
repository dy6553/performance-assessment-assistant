import Link from "next/link";

import { TopicRecommender } from "@/features/assessment/topic-recommender";

export default function TopicRecommenderPage() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4">
        <Link
          className="inline-flex min-h-12 items-center rounded-xl px-2 text-sm font-extrabold text-slate-500 transition active:scale-[0.98]"
          href="/"
          prefetch
        >
          ← 홈으로
        </Link>
      </div>
      <TopicRecommender />
    </main>
  );
}
