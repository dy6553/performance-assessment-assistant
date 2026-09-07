import Link from "next/link";

import { PageHeader } from "@/components/ui";
import { TextbookProfileSettings } from "@/features/assessment/textbook-profile-settings";
import { readSharedPersonalization } from "@/lib/personalization/shared-server";

export default async function TextbookSettingsPage() {
  const sharedPersonalization = await readSharedPersonalization();

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4">
        <Link
          className="inline-flex min-h-12 items-center rounded-xl px-2 text-sm font-extrabold text-slate-500 transition active:scale-[0.98]"
          href="/settings"
          prefetch
        >
          ← 설정 카테고리
        </Link>
      </div>
      <PageHeader
        description="교육과정·출판사·교과서·단원·쪽수를 과목별로 저장해 수행평가 전 과정의 기준으로 사용합니다."
        eyebrow="앱 설정"
        title="내 교과서"
      />
      <TextbookProfileSettings defaultPublisher={sharedPersonalization?.defaultPublisher ?? ""} />
    </main>
  );
}
