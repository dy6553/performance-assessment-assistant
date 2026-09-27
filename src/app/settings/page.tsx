import Link from "next/link";

import { PageHeader } from "@/components/ui";

const CATEGORIES = [
  {
    href: "/settings/generation",
    title: "수행평가 생성 기본 설정",
    description: "교육과정, 학교급, 학년, 과목, 수행평가 유형을 새 작업의 기본값으로 저장합니다.",
  },
  {
    href: "/settings/textbooks",
    title: "내 교과서",
    description: "교육과정, 출판사, 교과서, 단원·쪽수를 저장해 수행평가 전 과정에 자동 반영합니다.",
  },
  {
    href: "/settings/files",
    title: "PDF 및 파일",
    description: "결과 파일의 기본 파일명 규칙과 원하는 파일명 예시를 설정합니다.",
  },
  {
    href: "/settings/display",
    title: "화면",
    description: "테마와 글자 크기처럼 화면에 보이는 방식을 설정합니다.",
  },
  {
    href: "/settings/accessibility",
    title: "접근성",
    description: "고대비, 큰 조작 버튼, 애니메이션 설정을 관리합니다.",
  },
  {
    href: "/settings/behavior",
    title: "동작 및 성능",
    description: "빠른 반응, 진동, 데이터 절약, 화면 유지 기능을 설정합니다.",
  },
  {
    href: "/settings/notifications",
    title: "알림",
    description: "수행평가 도우미의 기기 알림 설정을 관리합니다.",
  },
  {
    href: "/settings/navigation",
    title: "시작 및 탐색",
    description: "앱을 열었을 때 처음 표시할 수행평가 화면을 설정합니다.",
  },
  {
    href: "/settings/devices",
    title: "내 기기 및 동기화",
    description: "암호화 자동백업 상태와 등록된 기기를 확인하고 다른 기기의 연결을 해제합니다.",
  },
  {
    href: "/settings/storage",
    title: "저장공간 및 데이터",
    description: "이 기기의 수행평가·AI 대화·캘린더·업로드 파일 용량, 저장 보호와 삭제를 관리합니다.",
  },
  {
    href: "/settings/backup",
    title: "백업 및 복원",
    description: "수행평가 작업 데이터와 앱 설정을 파일로 백업하거나 현재 계정에 복원합니다.",
  },
  {
    href: "/settings/about",
    title: "앱 정보",
    description: "앱 버전, PWA 설치와 설정 저장 방식을 확인합니다.",
  },
  {
    href: "/settings/misc",
    title: "기타",
    description: "앱 설정 초기화 같은 기타 설정을 관리합니다.",
  },
  {
    href: "/settings/connections",
    title: "연결 및 운영 상태",
    description: "NVIDIA AI, Supabase, Vercel 연결 상태와 데이터 처리 기준을 확인합니다.",
  },
] as const;

export default function SettingsPage() {
  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader
        description="카테고리를 누르면 해당 설정 화면으로 이동합니다. 주요 설정과 개인 작업 데이터는 현재 기기에서 관리할 수 있습니다."
        eyebrow="앱 설정"
        title="설정"
      />

      <div className="space-y-6">
        {[
          { title: "기본 설정", paths: ["/settings/generation", "/settings/textbooks", "/settings/files"] },
          { title: "화면 및 사용성", paths: ["/settings/display", "/settings/accessibility", "/settings/behavior"] },
          { title: "알림 및 시작", paths: ["/settings/notifications", "/settings/navigation"] },
          { title: "데이터", paths: ["/settings/devices", "/settings/storage", "/settings/backup"] },
          { title: "기타", paths: ["/settings/connections", "/settings/about", "/settings/misc"] },
        ].map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="mb-2 text-base font-black text-slate-900">{group.title}</h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {group.paths.map((path) => {
                const category = CATEGORIES.find((item) => item.href === path);
                if (!category) return null;
                return <Link key={path} href={path} className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-violet-50/50">
                  <span className="min-w-0"><span className="block font-bold text-slate-950">{category.title}</span><span className="block text-xs leading-5 text-slate-500">{category.description}</span></span>
                  <span className="shrink-0 text-violet-700" aria-hidden="true">›</span>
                </Link>;
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
