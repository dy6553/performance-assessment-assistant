import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";

const statusStyle = {
  ok: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  disconnected: "bg-slate-100 text-slate-600",
} as const;

const statusLabel = {
  ok: "정상",
  warning: "확인 필요",
  disconnected: "연결 필요",
} as const;

export default async function AdminPage() {
  const admin = await requireAdmin();
  const [userStats, ai, audits, assignmentCount, models] = await Promise.all([
    admin.repository.userStatusStats(),
    admin.repository.aiStats(),
    admin.repository.listAuditLogs(6),
    admin.repository.assignmentCount(),
    admin.repository.listModels(),
  ]);

  const cards = [
    ["전체 사용자", userStats.total],
    ["활성 사용자", userStats.active],
    ["제한·정지", userStats.restricted],
    ["전체 수행평가", assignmentCount],
    ["오늘 AI 작업", ai.total],
    ["실패", ai.failed],
  ] as const;

  const approvedModels = models.filter((model) => model.enabled && model.production_approved).length;
  const serviceStates = [
    {
      name: "NVIDIA AI",
      status: process.env.NVIDIA_API_KEY || process.env.Nvidia_key ? (ai.failed > 0 ? "warning" : "ok") : "disconnected",
      value: `${ai.total}회`,
      label: "오늘 AI 작업",
    },
    {
      name: "Supabase",
      status: (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL) && (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key) ? "ok" : "disconnected",
      value: `${userStats.total}명`,
      label: "등록 사용자",
    },
    {
      name: "Vercel",
      status: process.env.VERCEL || process.env.VERCEL_ENV ? "ok" : "disconnected",
      value: "운영 중",
      label: "앱 배포",
    },
    {
      name: "승인 AI 모델",
      status: approvedModels > 0 ? "ok" : "warning",
      value: `${approvedModels}개`,
      label: "활성·운영 승인",
    },
  ] as const;

  const attentionItems = [
    ai.failed > 0 ? `AI 작업 실패 ${ai.failed}건` : null,
    userStats.restricted > 0 ? `제한·정지 사용자 ${userStats.restricted}명` : null,
    ...serviceStates.filter((service) => service.status !== "ok").map((service) => `${service.name} ${statusLabel[service.status]}`),
  ].filter((item): item is string => Boolean(item));

  return (
    <>
      <PageHeader
        eyebrow="관리자"
        title="운영 대시보드"
        description="시험온 관리자 모드처럼 사용자, AI 작업, 모델과 운영 상태를 한 화면에서 확인합니다. 비밀키 원문은 표시하지 않습니다."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cards.map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-slate-950">AI·인프라 상태</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">주요 외부 서비스와 승인 모델 상태를 요약합니다.</p>
            </div>
            <Link className="shrink-0 text-sm font-extrabold text-violet-700" href="/admin/services">
              전체 보기 →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {serviceStates.map((service) => (
              <div className="rounded-2xl border border-slate-200 p-4" key={service.name}>
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-slate-900">{service.name}</strong>
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${statusStyle[service.status]}`}>
                    {statusLabel[service.status]}
                  </span>
                </div>
                <p className="mt-4 text-xs font-bold text-slate-500">{service.label}</p>
                <p className="mt-1 text-xl font-black text-slate-950">{service.value}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-black text-slate-950">주의 필요</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">운영자가 먼저 확인할 항목입니다.</p>
          <div className="mt-4 space-y-3">
            {attentionItems.length ? attentionItems.map((item) => (
              <div className="rounded-2xl bg-amber-50 p-4 text-sm font-extrabold text-amber-900" key={item}>{item}</div>
            )) : (
              <div className="rounded-2xl bg-emerald-50 p-4 text-sm font-extrabold text-emerald-800">현재 확인이 필요한 주요 항목이 없습니다.</div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-black text-slate-950">운영 정책</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Policy label="학생 데이터" value="계정 + 학교 범위 분리" />
            <Policy label="로그인 유지" value="Refresh Token 최대 30일" />
            <Policy label="평가표 PDF" value="최대 20MB · 6페이지" />
            <Policy label="관리자 변경" value="감사 로그 자동 기록" last />
          </dl>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-black text-slate-950">최근 관리자 작업</h2>
            <Link className="text-sm font-extrabold text-violet-700" href="/admin/audit-logs">전체 보기 →</Link>
          </div>
          <div className="mt-4 space-y-3">
            {audits.length ? audits.map((log) => (
              <div className="rounded-2xl bg-slate-50 p-4" key={log.id}>
                <p className="font-extrabold text-slate-900">{log.action}</p>
                <p className="mt-1 text-sm text-slate-500">{new Date(log.created_at).toLocaleString("ko-KR")}</p>
              </div>
            )) : <p className="text-slate-500">아직 관리자 작업 기록이 없습니다.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}

function Policy({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${last ? "" : "border-b border-slate-100 pb-4"}`}>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}
