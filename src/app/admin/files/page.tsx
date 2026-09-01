import Link from "next/link";

import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";
import { AdminAssignmentDataRepository } from "@/features/admin/server/assignment-data-repository";
import { AssignmentDataDeleteButton } from "./assignment-data-delete-button";

export const dynamic = "force-dynamic";

export default async function AdminFilesPage() {
  const admin = await requireAdmin();
  const repository = new AdminAssignmentDataRepository();
  const records = await repository.listAssignments();
  const canDelete = admin.role === "SUPER_ADMIN";

  return (
    <>
      <PageHeader
        eyebrow="관리자"
        title="수행평가 데이터 관리"
        description="시험온의 Storage·생성 데이터 관리와 같은 역할을 수행평가 도우미 데이터 구조에 맞춰 제공합니다. 수행평가를 삭제하면 연결된 교육과정·루브릭·출처·초안·검증·AI 실행 기록도 함께 정리됩니다."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center rounded-2xl bg-violet-50 px-4 text-sm font-extrabold text-violet-700" href="/admin/database">Database 관리</Link>
        <Link className="inline-flex min-h-11 items-center rounded-2xl bg-emerald-50 px-4 text-sm font-extrabold text-emerald-700" href="/admin/audit-logs">감사 로그</Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm font-bold text-slate-500">수행평가 기록</p><p className="mt-2 text-3xl font-black">{records.length}개</p></Card>
        <Card><p className="text-sm font-bold text-slate-500">삭제 권한</p><p className="mt-2 text-xl font-black">{canDelete ? "최고 관리자" : "조회만 가능"}</p></Card>
        <Card><p className="text-sm font-bold text-slate-500">PDF 원본 Storage</p><p className="mt-2 text-xl font-black">영구 저장 안 함</p><p className="mt-1 text-xs text-slate-400">업로드 분석 후 서버에 원본을 보관하지 않음</p></Card>
      </div>

      <Card className="mt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">최근 수행평가 데이터</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">최대 300개를 최신순으로 표시합니다. 삭제는 최고 관리자만 가능합니다.</p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {records.length ? records.map((record) => (
            <div className="rounded-[1.6rem] border border-slate-200 bg-slate-50/70 p-4" key={record.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-slate-950">{record.topic || "제목 없는 수행평가"}</p>
                    <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-700">{record.subject}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{record.status}</span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-600">{record.ownerLabel}{record.schoolName ? ` · ${record.schoolName}` : ""}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{record.assignmentType || "유형 미설정"} · 생성 {new Date(record.createdAt).toLocaleString("ko-KR")} · ID {record.id.slice(0, 8)}</p>
                </div>
                {canDelete ? <AssignmentDataDeleteButton assignmentId={record.id} label={record.topic || record.subject} /> : null}
              </div>
            </div>
          )) : <p className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">저장된 수행평가 데이터가 없습니다.</p>}
        </div>
      </Card>

      <Card className="mt-5">
        <h2 className="text-lg font-black text-slate-950">삭제 범위</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">수행평가 최상위 레코드를 삭제하며, 데이터베이스의 외래키 연쇄 삭제 정책에 따라 해당 수행평가에 연결된 교육과정 맥락, 루브릭, 출처, 초안, 검증 결과, 주장·근거, AI 실행과 모델 라우팅 기록이 함께 삭제됩니다. 사용자 계정과 다른 수행평가는 삭제하지 않습니다.</p>
      </Card>
    </>
  );
}
