import type { ReactNode } from "react";

import { AdminNav } from "@/features/admin/admin-nav";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();

  return (
    <main className="mx-auto min-h-[calc(100dvh-4rem)] max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-violet-100 bg-violet-50/80 px-4 py-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">관리자 모드</p>
          <p className="mt-1 text-sm font-extrabold text-slate-700">
            {admin.role === "SUPER_ADMIN" ? "최고 관리자" : "관리자"}
          </p>
        </div>
        <a className="text-sm font-black text-violet-700" href="/">
          사용자 화면으로 돌아가기 →
        </a>
      </div>
      <AdminNav />
      {children}
    </main>
  );
}
