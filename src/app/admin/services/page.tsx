import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminServicesPage() {
  const admin = await requireAdmin();
  const [ai, models, users] = await Promise.all([
    admin.repository.aiStats(),
    admin.repository.listModels(),
    admin.repository.listUsers(),
  ]);

  const services = [
    {
      name: "NVIDIA AI",
      connected: Boolean(process.env.NVIDIA_API_KEY || process.env.Nvidia_key),
      description: "평가표 판독, 주제 추천, 초안 생성, 검증과 AI 채점에 사용합니다.",
      metric: `오늘 ${ai.total}회 · 실패 ${ai.failed}회`,
    },
    {
      name: "Supabase",
      connected: Boolean((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL) && (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)),
      description: "로그인, 사용자 프로필, 학교별 데이터 격리, 모델 레지스트리와 관리자 기록을 저장합니다.",
      metric: `사용자 ${users.length}명 · 모델 ${models.length}개`,
    },
    {
      name: "Vercel",
      connected: Boolean(process.env.VERCEL || process.env.VERCEL_ENV),
      description: "Next.js 앱과 서버 API를 프로덕션에서 실행합니다.",
      metric: process.env.VERCEL_ENV ? `환경 ${process.env.VERCEL_ENV}` : "배포 환경 확인 필요",
    },
  ];

  return (
    <>
      <PageHeader eyebrow="관리자" title="AI·인프라" description="시험온 관리자 모드처럼 AI와 운영 인프라의 연결 상태와 사용량을 확인합니다. 키 원문은 노출하지 않습니다." />

      <div className="grid gap-4 md:grid-cols-3">
        {services.map((service) => (
          <Card key={service.name}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black text-slate-950">{service.name}</h2>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${service.connected ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                {service.connected ? "연결됨" : "설정 필요"}
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">{service.description}</p>
            <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">{service.metric}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-black text-slate-950">오늘 AI 모델 사용량</h2>
          <div className="mt-4 space-y-3">
            {ai.models.length ? ai.models.map((item) => (
              <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 p-4" key={item.modelId}>
                <span className="min-w-0 break-all text-sm font-bold text-slate-700">{item.modelId}</span>
                <strong className="shrink-0 text-violet-700">{item.count}회</strong>
              </div>
            )) : <p className="text-sm text-slate-500">오늘 기록된 AI 작업이 없습니다.</p>}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-black text-slate-950">AI 작업 상태</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Stat label="전체" value={`${ai.total}회`} />
            <Stat label="완료" value={`${ai.completed}회`} />
            <Stat label="진행 중" value={`${ai.running}회`} />
            <Stat label="실패" value={`${ai.failed}회`} last />
          </dl>
        </Card>
      </div>
    </>
  );
}

function Stat({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${last ? "" : "border-b border-slate-100 pb-4"}`}>
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="font-black text-slate-900">{value}</dd>
    </div>
  );
}
