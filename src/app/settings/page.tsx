import Link from "next/link";

import { Icon } from "@/components/icons";
import { InstallAppButton } from "@/components/install-app-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, PageHeader, StatusCard } from "@/components/ui";

const screens = [
  ["수행평가 만들기", "/"],
  ["설정·운영 상태", "/settings"],
] as const;

export default function SettingsPage() {
  const connections = [
    { name: "NVIDIA AI", connected: Boolean(process.env.NVIDIA_API_KEY), description: "평가표 판독과 전략·초안·검증에 사용합니다." },
    { name: "Supabase", connected: Boolean(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL), description: "검토를 통과한 AI 모델 목록을 관리합니다." },
    { name: "Vercel", connected: Boolean(process.env.VERCEL || process.env.VERCEL_ENV), description: "웹 앱과 서버 API를 실행합니다." },
  ];

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader description="실제 API 연결 상태와 데이터 처리 기준을 확인합니다. 비밀키 원문은 표시하지 않습니다." eyebrow="앱 관리" title="설정과 운영 상태" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold text-violet-700">화면 테마</p>
              <h2 className="mt-1 text-lg font-black">라이트·다크 모드</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">선택한 모드는 이 기기에 저장됩니다.</p>
            </div>
            <ThemeToggle />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="size-5" name="settings" /></span>
            <div><p className="text-sm font-extrabold text-blue-700">정식 API 모드</p><h2 className="font-black">연결 서비스</h2></div>
          </div>
          <div className="mt-5 space-y-3">
            {connections.map((connection) => (
              <div className="rounded-2xl border border-slate-200 p-4" key={connection.name}>
                <div className="flex items-center justify-between gap-3">
                  <strong>{connection.name}</strong>
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${connection.connected ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {connection.connected ? "연결됨" : "설정 필요"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-500">{connection.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-black">데이터·사용량 보호</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <SettingRow label="입력·생성 결과 서버 보관" value="저장 안 함" />
            <SettingRow label="평가표 PDF" value="최대 4MB" />
            <SettingRow label="PDF 판독 범위" value="최대 6페이지" />
            <SettingRow label="AI 처리 시간" value="요청당 최대 5분" last />
          </dl>
          <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">입력한 내용과 PDF는 NVIDIA AI 처리에 전송되며, 앱 데이터베이스에는 저장하지 않습니다.</div>
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold text-violet-700">갤럭시</p>
              <h2 className="mt-1 text-lg font-black">앱으로 설치</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">삼성 인터넷에서 홈 화면 앱으로 설치할 수 있습니다.</p>
            </div>
            <InstallAppButton />
          </div>
        </Card>
      </div>

      <section className="mt-5"><StatusCard description="로그인 없이 바로 사용할 수 있으며, 작성 내용은 현재 브라우저를 닫으면 남지 않습니다." title="비회원 즉시 사용 가능" /></section>

      <section className="mt-5">
        <Card>
          <h2 className="text-lg font-black">전체 화면 바로가기</h2>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {screens.map(([label, href]) => (
              <Link aria-current={href === "/settings" ? "page" : undefined} className="flex min-h-12 items-center justify-between rounded-2xl border border-slate-200 px-4 text-sm font-extrabold text-slate-600 transition hover:border-blue-200 hover:text-blue-700" href={href} key={href}>
                <span>{label}</span><span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </main>
  );
}

function SettingRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return <div className={`flex justify-between gap-4 ${last ? "" : "border-b border-slate-100 pb-4"}`}><dt className="text-slate-500">{label}</dt><dd className="text-right font-extrabold">{value}</dd></div>;
}
