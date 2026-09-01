import { notFound } from "next/navigation";

import { updateUserRoleAction, updateUserStatusAction } from "@/app/admin/actions";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await admin.repository.getUser(id);
  if (!user) notFound();

  return (
    <>
      <PageHeader
        backHref="/admin/users"
        eyebrow="관리자"
        title={user.developerId ? `개발자 ${user.developerId}` : user.nickname || "사용자 상세"}
        description="계정 정보와 사용량을 확인하고 상태와 관리자 권한을 관리합니다."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-black text-slate-950">사용자 정보</h2>
          <dl className="mt-5 space-y-4 text-sm">
            {user.developerId ? <Info label="개발자 ID" value={user.developerId} /> : <Info label="이메일" value={user.email} />}
            <Info label="학교" value={user.schoolName || "미등록"} />
            <Info label="나이" value={user.age ? `${user.age}세` : "미등록"} />
            <Info label="권한" value={roleLabel(user.role)} />
            <Info label="계정 상태" value={statusLabel(user.status)} />
            <Info label="수행평가" value={`${user.assignmentCount}개`} />
            <Info label="오늘 AI 작업" value={`${user.todayAiRuns}회`} />
            <Info label="가입일" value={new Date(user.createdAt).toLocaleString("ko-KR")} />
            <Info label="최근 로그인" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ko-KR") : "기록 없음"} last />
          </dl>
        </Card>

        <div className="space-y-5">
          <Card>
            <h2 className="text-lg font-black text-slate-950">계정 상태</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">정지는 앱 사용을 중단해야 할 계정에 사용하고, 제한은 운영상 주의가 필요한 상태를 표시합니다.</p>
            <form action={updateUserStatusAction} className="mt-5 flex gap-2">
              <input name="userId" type="hidden" value={user.id} />
              <select className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-900" defaultValue={user.status} name="status">
                <option value="ACTIVE">활성</option>
                <option value="LIMITED">제한</option>
                <option value="SUSPENDED">정지</option>
              </select>
              <button className="min-h-12 rounded-2xl bg-violet-600 px-5 font-black text-white" type="submit">적용</button>
            </form>
          </Card>

          <Card>
            <h2 className="text-lg font-black text-slate-950">관리자 권한</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {admin.role === "SUPER_ADMIN" ? "최고 관리자만 다른 사용자의 관리자 권한을 변경할 수 있습니다." : "최고 관리자만 변경할 수 있습니다."}
            </p>
            {admin.role === "SUPER_ADMIN" ? (
              <form action={updateUserRoleAction} className="mt-5 flex gap-2">
                <input name="userId" type="hidden" value={user.id} />
                <select className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-900" defaultValue={user.role} name="role">
                  <option value="USER">사용자</option>
                  <option value="ADMIN">관리자</option>
                  <option value="SUPER_ADMIN">최고 관리자</option>
                </select>
                <button className="min-h-12 rounded-2xl bg-slate-900 px-5 font-black text-white" type="submit">권한 변경</button>
              </form>
            ) : (
              <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-500">현재 계정에는 권한 변경 권한이 없습니다.</div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-4 ${last ? "" : "border-b border-slate-100 pb-4"}`}>
      <dt className="font-bold text-slate-500">{label}</dt>
      <dd className="max-w-[70%] break-all text-right font-extrabold text-slate-900">{value}</dd>
    </div>
  );
}

function roleLabel(role: "USER" | "ADMIN" | "SUPER_ADMIN") {
  if (role === "SUPER_ADMIN") return "최고 관리자";
  if (role === "ADMIN") return "관리자";
  return "사용자";
}

function statusLabel(status: "ACTIVE" | "LIMITED" | "SUSPENDED") {
  if (status === "SUSPENDED") return "정지";
  if (status === "LIMITED") return "제한";
  return "활성";
}
