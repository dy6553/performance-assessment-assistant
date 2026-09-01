import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";
import { AdminDatabaseRepository } from "@/features/admin/server/database-repository";

export const dynamic = "force-dynamic";

const modeLabel = {
  delete: "안전 삭제 가능",
  manage: "전용 관리",
  read_only: "조회 전용",
} as const;

const modeStyle = {
  delete: "bg-rose-50 text-rose-700",
  manage: "bg-emerald-50 text-emerald-700",
  read_only: "bg-slate-100 text-slate-600",
} as const;

export default async function AdminDatabasePage() {
  await requireAdmin();
  const repository = new AdminDatabaseRepository();
  const tables = await repository.listTableStats();
  const knownCounts = tables.filter((table) => typeof table.count === "number");
  const totalRows = knownCounts.reduce((sum, table) => sum + (table.count ?? 0), 0);
  const deletable = tables.filter((table) => table.mode === "delete").length;

  return (
    <>
      <PageHeader
        eyebrow="관리자"
        title="Database 관리"
        description="수행평가 도우미의 주요 Supabase 테이블을 안전하게 조회합니다. 원시 SQL·테이블 삭제·스키마 변경은 제공하지 않습니다."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-bold text-slate-500">관리 대상 테이블</p><p className="mt-2 text-3xl font-black">{tables.length}개</p></Card>
        <Card>
          <p className="text-sm font-bold text-slate-500">확인된 레코드</p>
          <p className="mt-2 text-3xl font-black">{formatNumber(totalRows)}개</p>
          {knownCounts.length !== tables.length ? <p className="mt-1 text-xs font-bold text-amber-700">일부 테이블 집계 실패</p> : null}
        </Card>
        <Card><p className="text-sm font-bold text-slate-500">안전 삭제 영역</p><p className="mt-2 text-3xl font-black">{deletable}개</p><p className="mt-1 text-xs text-slate-400">수행평가 단위 연쇄 삭제</p></Card>
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">테이블 현황</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">앱 운영에 필요한 public 테이블만 표시하고 인증 내부 테이블은 숨깁니다.</p>
          </div>
          <Link className="inline-flex min-h-11 items-center rounded-2xl bg-violet-50 px-4 text-sm font-extrabold text-violet-700" href="/admin/files">수행평가 데이터 관리</Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {tables.map((table) => (
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-4" key={table.table}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="font-black text-slate-900">{table.label}</p><p className="mt-1 break-all text-xs font-bold text-slate-400">{table.table}</p></div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${modeStyle[table.mode]}`}>{modeLabel[table.mode]}</span>
              </div>
              <p className="mt-4 text-xs font-bold text-slate-500">레코드 수</p>
              <p className="mt-1 text-2xl font-black">{typeof table.count === "number" ? `${formatNumber(table.count)}개` : "조회 실패"}</p>
              <p className="mt-3 min-h-12 text-sm leading-6 text-slate-500">{table.description}</p>
              {table.manageHref ? (
                <Link className={`mt-3 inline-flex min-h-11 items-center rounded-2xl px-4 text-sm font-extrabold ${table.mode === "delete" ? "border border-rose-200 bg-white text-rose-700" : "bg-violet-50 text-violet-700"}`} href={table.manageHref}>
                  {table.manageLabel ?? "관리"}
                </Link>
              ) : <p className="mt-3 text-xs font-bold text-slate-400">데이터 보호를 위해 직접 삭제 기능 없음</p>}
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-black">관리자에서 삭제 가능한 데이터</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>수행평가 최상위 기록을 삭제하면 연결된 교육과정, 루브릭, 출처, 초안, 주장, 검증 결과와 AI 실행 기록도 외래키 정책에 따라 함께 정리됩니다.</li>
            <li>삭제 전 확인 단계를 거치며 관리자 감사 로그에 기록합니다.</li>
            <li>평가표 PDF 원본은 현재 서버에 영구 저장하지 않아 별도 Storage 삭제 대상이 없습니다.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-black">Supabase에서만 하는 작업</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>SQL 직접 실행</li><li>테이블·컬럼 생성 또는 삭제</li><li>RLS 정책·인덱스·함수 변경</li></ul>
          <a className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-violet-50 px-4 text-sm font-extrabold text-violet-700" href="https://supabase.com/dashboard" rel="noreferrer" target="_blank">Supabase 공식 관리 화면</a>
        </Card>
      </div>
    </>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.max(0, Math.round(value)));
}
