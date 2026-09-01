import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";
import {
  approveDeveloperAccountAction,
  createDeveloperAccountAction,
  resetDeveloperPasswordAction,
  revokeDeveloperAccountAction,
} from "./actions";
import { DeveloperRemoveButton } from "./developer-remove-button";

type DeveloperUser = {
  id: string;
  user_metadata?: {
    account_type?: string;
    developer_id?: string;
    developer_approved?: boolean;
  };
};

function config() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  if (!baseUrl || !secretKey) throw new Error("ADMIN_SUPABASE_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey };
}

function displayDeveloperId(rawId: string) {
  return rawId.toLowerCase() === "gpt-admin" ? "i123" : rawId;
}

async function listDevelopers(): Promise<DeveloperUser[]> {
  const { baseUrl, secretKey } = config();
  const response = await fetch(`${baseUrl}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: {
      Accept: "application/json",
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("DEVELOPER_LIST_FAILED");
  const data = (await response.json()) as { users?: DeveloperUser[] };
  return (data.users ?? []).filter((user) => user.user_metadata?.account_type === "developer_test");
}

export default async function AdminDevelopersPage() {
  const admin = await requireAdmin("SUPER_ADMIN");
  const developers = await listDevelopers();
  const withProfiles = await Promise.all(
    developers.map(async (user) => ({ user, profile: await admin.repository.getProfile(user.id) })),
  );
  const visibleDevelopers = withProfiles
    .filter(({ profile }) => profile?.account_status !== "SUSPENDED")
    .map(({ user }) => user);

  return (
    <>
      <PageHeader
        eyebrow="관리자"
        title="개발자 테스트 계정"
        description="이메일 없이 개발자 ID와 비밀번호로 테스트 계정을 만들고, 최고 관리자 승인 후에만 로그인할 수 있습니다."
      />

      <Card>
        <form action={createDeveloperAccountAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">개발자 ID</span>
            <input className="min-h-12 w-full rounded-2xl border border-slate-200 px-4" name="developerId" pattern="[A-Za-z0-9_-]{3,32}" placeholder="gpt-test-01" required />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black text-slate-700">테스트 비밀번호</span>
            <input className="min-h-12 w-full rounded-2xl border border-slate-200 px-4" minLength={8} name="password" placeholder="8자 이상" required type="password" />
          </label>
          <button className="min-h-12 rounded-2xl bg-violet-600 px-5 font-extrabold text-white" type="submit">승인 대기로 생성</button>
        </form>
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">Supabase 인증에 필요한 내부 주소는 서버에서 자동 생성되며 사용자에게 입력·노출되지 않습니다.</p>
      </Card>

      <div className="mt-5 space-y-3">
        {visibleDevelopers.length ? visibleDevelopers.map((user) => {
          const storedDeveloperId = user.user_metadata?.developer_id ?? "알 수 없음";
          const developerId = displayDeveloperId(storedDeveloperId);
          const approved = user.user_metadata?.developer_approved === true;
          const isCurrentAdmin = user.id === admin.user.id;
          const isGptAdmin = developerId.toLowerCase() === "i123";
          return (
            <Card key={user.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{developerId}</p>
                  <p className={`mt-1 text-sm font-extrabold ${approved ? "text-emerald-700" : "text-amber-700"}`}>{approved ? "승인됨 · 로그인 가능" : "승인 대기 · 로그인 차단"}</p>
                  {isGptAdmin ? <p className="mt-1 text-xs font-black text-violet-700">GPT 최고 관리자 계정</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={approved ? revokeDeveloperAccountAction : approveDeveloperAccountAction}>
                    <input name="userId" type="hidden" value={user.id} />
                    <input name="developerId" type="hidden" value={developerId} />
                    <button className={`min-h-11 rounded-xl px-4 text-sm font-extrabold ${approved ? "bg-amber-50 text-amber-800" : "bg-emerald-600 text-white"}`} type="submit">
                      {approved ? "승인 해제" : "승인"}
                    </button>
                  </form>
                  {!isCurrentAdmin ? <DeveloperRemoveButton developerId={developerId} userId={user.id} /> : null}
                </div>
              </div>

              <form action={resetDeveloperPasswordAction} className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
                <input name="userId" type="hidden" value={user.id} />
                <input name="developerId" type="hidden" value={developerId} />
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{developerId} 새 비밀번호</span>
                  <input
                    autoComplete="new-password"
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm"
                    minLength={8}
                    name="password"
                    placeholder="새 비밀번호 8자 이상"
                    required
                    type="password"
                  />
                </label>
                <button className="min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-extrabold text-white" type="submit">비밀번호 변경</button>
              </form>
            </Card>
          );
        }) : <Card><p className="text-slate-500">개발자 테스트 계정이 없습니다.</p></Card>}
      </div>

      <Link className="mt-5 inline-block text-sm font-extrabold text-violet-700" href="/admin/users">← 사용자 관리로</Link>
    </>
  );
}
