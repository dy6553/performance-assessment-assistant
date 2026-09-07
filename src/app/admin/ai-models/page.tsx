import { updateModelFlagAction } from "@/app/admin/actions";
import { Card, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/features/admin/server/auth";

export default async function AdminAiModelsPage() {
  const admin = await requireAdmin();
  const models = await admin.repository.listModels();

  return (
    <>
      <PageHeader
        eyebrow="관리자"
        title="AI 모델 관리"
        description="시험온처럼 승인 모델의 사용 여부와 운영 승인 상태를 관리합니다. 보안·개인정보 검토 상태도 함께 확인합니다."
      />

      <div className="space-y-3">
        {models.map((model) => {
          const available = model.catalog_available && !model.deprecated;
          const inUse = model.enabled && model.production_approved && available;
          const safe = model.approved_provider && model.approved_model && model.allowed_for_student_data && model.security_review_passed && model.privacy_policy_verified && model.catalog_available && !model.deprecated;
          return (
            <Card key={model.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-all font-black text-slate-950">{model.model_id}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${inUse ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {inUse ? "사용 중" : "사용 안 함"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${model.production_approved ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-800"}`}>
                      {model.production_approved ? "운영 승인" : "운영 미승인"}
                    </span>
                    {!available ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">현재 사용 불가</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500">{model.developer_company} · {model.country_of_headquarters} · {model.provider}</p>
                  <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                    <Check label="학생 데이터 허용" ok={model.allowed_for_student_data} />
                    <Check label="보안 검토" ok={model.security_review_passed} />
                    <Check label="개인정보 검토" ok={model.privacy_policy_verified} />
                  </div>
                  {!available ? (
                    <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">NVIDIA 카탈로그에서 종료되었거나 현재 호출할 수 없어 라우팅에서 제외됩니다.</p>
                  ) : !safe ? (
                    <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">필수 검토 항목을 모두 통과하지 않은 모델입니다.</p>
                  ) : null}
                </div>

                <div className="flex min-w-40 flex-col gap-2">
                  {admin.role === "SUPER_ADMIN" ? (
                    <>
                      <ModelFlagForm disabled={!available} field="enabled" label={model.enabled ? "사용 중지" : "사용 허용"} modelId={model.model_id} value={!model.enabled} />
                      <ModelFlagForm disabled={!available} field="production_approved" label={model.production_approved ? "운영 승인 해제" : "운영 승인"} modelId={model.model_id} value={!model.production_approved} dark />
                    </>
                  ) : (
                    <p className="rounded-2xl bg-slate-50 p-3 text-center text-xs font-bold text-slate-500">최고 관리자만 변경 가능</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Check({ label, ok }: { label: string; ok: boolean }) {
  return <div className={`rounded-xl px-3 py-2 font-bold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{ok ? "✓" : "!"} {label}</div>;
}

function ModelFlagForm({ modelId, field, value, label, dark = false, disabled = false }: { modelId: string; field: "enabled" | "production_approved"; value: boolean; label: string; dark?: boolean; disabled?: boolean }) {
  return (
    <form action={updateModelFlagAction}>
      <input name="modelId" type="hidden" value={modelId} />
      <input name="field" type="hidden" value={field} />
      <input name="value" type="hidden" value={String(value)} />
      <button className={`min-h-11 w-full rounded-xl px-4 text-sm font-black disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${dark ? "bg-slate-900 text-white" : "bg-violet-50 text-violet-700"}`} disabled={disabled} type="submit">{disabled ? "현재 사용 불가" : label}</button>
    </form>
  );
}
