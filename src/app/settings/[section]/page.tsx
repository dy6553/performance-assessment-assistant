import Link from "next/link";
import { notFound } from "next/navigation";

import { SettingsPreferences, type SettingsSection } from "@/components/settings-preferences";
import { PageHeader } from "@/components/ui";
import packageJson from "../../../../package.json";

const SECTION_META: Record<SettingsSection, { title: string; description: string }> = {
  generation: {
    title: "수행평가 생성 기본 설정",
    description: "새 수행평가를 시작할 때 자동으로 적용할 교육과정, 학교급, 학년, 과목과 유형을 지정합니다.",
  },
  files: {
    title: "PDF·파일 기본 설정",
    description: "결과 파일을 저장할 때 참고할 파일명 형식, 앞글자와 구분자를 설정합니다.",
  },
  display: {
    title: "화면",
    description: "테마와 글자 크기처럼 화면에 보이는 방식을 설정합니다.",
  },
  accessibility: {
    title: "접근성",
    description: "텍스트와 조작 요소를 더 편하게 사용할 수 있도록 조절합니다.",
  },
  behavior: {
    title: "동작 및 성능",
    description: "버튼 반응, 데이터 사용량, 진동과 화면 유지 방식을 설정합니다.",
  },
  notifications: {
    title: "알림",
    description: "수행평가 도우미가 기기에 표시하는 알림 설정을 관리합니다.",
  },
  navigation: {
    title: "시작 및 탐색",
    description: "앱을 열었을 때 처음 표시할 수행평가 화면을 설정합니다.",
  },
  storage: {
    title: "저장공간 및 데이터",
    description: "브라우저 캐시와 현재 작업 데이터를 확인하고 자동·수동 정리 기능을 관리합니다.",
  },
  backup: {
    title: "설정 백업 및 복원",
    description: "주요 앱 설정을 JSON 파일로 내보내거나 다른 기기에서 다시 불러옵니다.",
  },
  about: {
    title: "앱 정보",
    description: "수행평가 도우미의 버전, 앱 형태와 기기 설정 저장 방식을 확인합니다.",
  },
  misc: {
    title: "기타",
    description: "수행평가 도우미의 기타 설정과 전체 설정 초기화를 관리합니다.",
  },
  connections: {
    title: "연결 및 운영 상태",
    description: "NVIDIA AI, Supabase, Vercel 연결 상태와 데이터 처리 기준을 확인합니다. 비밀키 원문은 표시하지 않습니다.",
  },
};

export function generateStaticParams() {
  return Object.keys(SECTION_META).map((section) => ({ section }));
}

function isSettingsSection(value: string): value is SettingsSection {
  return value in SECTION_META;
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();

  const meta = SECTION_META[section];
  const nvidiaApiKey = process.env.NVIDIA_API_KEY || process.env.Nvidia_key;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key;
  const connections = [
    {
      name: "NVIDIA AI",
      connected: Boolean(nvidiaApiKey),
      description: "평가표 판독과 전략·초안·검증, AI 주제 추천에 사용합니다.",
    },
    {
      name: "Supabase",
      connected: Boolean(supabaseSecretKey && supabaseUrl),
      description: "검토를 통과한 AI 모델 목록을 관리합니다.",
    },
    {
      name: "Vercel",
      connected: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
      description: "웹 앱과 서버 API를 실행합니다.",
    },
  ];

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

      <PageHeader description={meta.description} eyebrow="앱 설정" title={meta.title} />

      <SettingsPreferences
        appVersion={packageJson.version}
        connections={section === "connections" ? connections : []}
        section={section}
      />
    </main>
  );
}
