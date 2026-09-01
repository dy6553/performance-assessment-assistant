import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireAdmin();
  const { q = "" } = await searchParams;
  const query = Array.isArray(q) ? q[0] ?? "" : q;
  const users = await admin.repository.listUsers(query);

  return (
    <>
      <PageHeader eyebrow="관리자" title="사용자 관리" description="이메일·닉네임·학교명·권한·계정 상태로 검색할 수 있습니다." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <form className="flex min-w-0 flex-1 gap-2">
          <label className="sr-only" htmlFor="user-search">사용자 검색</label>
          <input
            className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 font-semibold text-slate-900 outline-none focus:border-violet-400"
            defaultValue={query}
            id="user-search"
            name="q"
            placeholder="이메일, 닉네임, 학교명"
          />
          <button className="min-h-12 rounded-2xl bg-violet-600 px-5 font-extrabold text-white" type="submit">검색</button>
        </form>
        <Link className="min-h-12 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-extrabold text-white" href="/admin/developers">개발자 테스트 계정</Link>
      </div>

      <div className="space-y-3">
        {users.length ? users.map((user) => (
          <Card key={user.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-950">{user.nickname ?? "이름 미설정"}</p>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">{roleLabel(user.role)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(user.status)}`}>{statusLabel(user.status)}</span>
                </div>
                <p className="mt-1 break-all text-sm text-slate-600">{maskEmail(user.email)}</p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {user.schoolName || "학교 미설정"} · {user.age ? `${user.age}세` : "나이 미설정"} · 수행평가 {user.assignmentCount}개 · 오늘 AI {user.todayAiRuns}회
                </p>
              </div>
              <Link className="min-h-11 rounded-xl bg-violet-50 px-4 py-2.5 text-sm font-extrabold text-violet-700" href={`/admin/users/${user.id}`}>
                상세 관리
              </Link>
            </div>
          </Card>
        )) : (
          <Card><p className="text-slate-500">조건에 맞는 사용자가 없습니다.</p></Card>
        )}
      </div>
    </>
  );
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain || !name) return email;
  return `${name.slice(0, 2)}***@${domain}`;
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

function statusClass(status: "ACTIVE" | "LIMITED" | "SUSPENDED") {
  if (status === "SUSPENDED") return "bg-rose-50 text-rose-700";
  if (status === "LIMITED") return "bg-amber-50 text-amber-800";
  return "bg-emerald-50 text-emerald-700";
}
