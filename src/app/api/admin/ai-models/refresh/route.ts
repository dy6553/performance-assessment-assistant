import { getAdminContext } from "@/features/admin/server/auth";
import { autoReviewDailyModelCatalog } from "@/lib/ai/model-auto-approval";
import { refreshModelCatalog } from "@/lib/ai/router";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const admin = await getAdminContext();
  if (admin?.role !== "SUPER_ADMIN") {
    return Response.json({ success: false, error: "찾을 수 없습니다." }, { status: 404 });
  }

  try {
    const catalog = await refreshModelCatalog();
    if (!catalog.synced) {
      return Response.json(
        { success: false, error: "모델 목록 저장에 실패했습니다." },
        { status: 503 },
      );
    }

    const autoApproval = await autoReviewDailyModelCatalog(catalog.catalogIds);
    await admin.repository.addAuditLog({
      admin_user_id: admin.user.id,
      action: "AI 모델 목록 갱신 및 자동 심사",
      target_type: "AI_MODEL",
      target_id: null,
      reason: null,
      metadata: {
        catalogModelCount: catalog.catalogIds.length,
        observedAt: catalog.observedAt,
        checked: autoApproval.checked,
        approved: autoApproval.approved,
        rejected: autoApproval.rejected,
        pending: autoApproval.pending,
      },
    });

    return Response.json({
      success: true,
      catalogModelCount: catalog.catalogIds.length,
      observedAt: catalog.observedAt,
      autoApproval,
    });
  } catch (error) {
    console.warn("Admin model catalog refresh failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
    });
    return Response.json(
      { success: false, error: "모델 목록 갱신 및 심사에 실패했습니다." },
      { status: 503 },
    );
  }
}
