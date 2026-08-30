import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminAuditLogsPage() {
  const admin = await requireAdmin();
  const logs = await admin.repository.listAuditLogs(200);

  return (
    <>
      <PageHeader eyebrow="관리자" title="감사 로그" description="사용자 상태, 권한, AI 모델 설정처럼 관리자 모드에서 변경한 주요 작업을 시간순으로 기록합니다." />
      <div className="space-y-3">
        {logs.length ? logs.map((log) => (
          <Card key={log.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-black text-slate-950">{log.action}</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">{log.target_type}</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">대상: {log.target_id || "시스템"}</p>
                {log.reason ? <p className="mt-1 text-sm text-slate-500">사유: {log.reason}</p> : null}
              </div>
              <time className="shrink-0 text-xs font-bold text-slate-400">{new Date(log.created_at).toLocaleString("ko-KR")}</time>
            </div>
          </Card>
        )) : (
          <Card><p className="text-slate-500">아직 기록된 관리자 작업이 없습니다.</p></Card>
        )}
      </div>
    </>
  );
}
