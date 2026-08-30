import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();

  const policies = [
    ["관리자 권한", "USER / ADMIN / SUPER_ADMIN 3단계"],
    ["관리자 접근", "ACTIVE 상태의 관리자 계정만 허용"],
    ["사용자 데이터", "사용자 ID + 학교 범위로 분리"],
    ["학교 변경", "이전 학교 수행평가 데이터는 현재 학교에서 숨김"],
    ["관리자 작업 기록", "사용자 상태·권한·AI 모델 변경을 감사 로그에 기록"],
    ["AI 비밀키", "관리자 화면에 원문 표시 안 함"],
    ["평가표 PDF", "최대 20MB / 6페이지"],
    ["로그인 유지", "Refresh Token 최대 30일"],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="관리자"
        title="관리자 설정"
        description="시험온 관리자 모드의 운영 원칙을 수행평가 도우미에 맞춰 확인합니다. 민감한 서버 키는 이 화면에서 수정하거나 표시하지 않습니다."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-black text-slate-950">현재 관리자 권한</h2>
          <div className="mt-4 rounded-2xl bg-violet-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">권한 등급</p>
            <p className="mt-2 text-2xl font-black text-violet-950">{admin.role === "SUPER_ADMIN" ? "최고 관리자" : "관리자"}</p>
          </div>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
            최고 관리자는 다른 사용자의 관리자 등급과 AI 모델 운영 승인 상태까지 변경할 수 있습니다.
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-black text-slate-950">초기 최고 관리자</h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
            관리자 기능을 처음 설치할 때 기존 사용자가 한 명뿐이면 그 계정을 최고 관리자로 지정합니다. 이후에는 최고 관리자가 사용자 상세 화면에서 권한을 관리합니다.
          </p>
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
            서버 환경변수 <code>SUPER_ADMIN_EMAILS</code>를 설정하면 지정 이메일도 최고 관리자 권한으로 인식할 수 있습니다.
          </p>
        </Card>
      </div>

      <Card className="mt-5">
        <h2 className="text-lg font-black text-slate-950">운영·보안 정책</h2>
        <dl className="mt-5 divide-y divide-slate-100">
          {policies.map(([label, value]) => (
            <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6" key={label}>
              <dt className="font-bold text-slate-500">{label}</dt>
              <dd className="font-extrabold text-slate-900 sm:text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}
