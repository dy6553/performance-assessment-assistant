import { getAdminContext } from "@/features/admin/server/auth";
import { refreshModelCatalog } from "@/lib/ai/router";
import { syncSharedApprovedModelRegistry } from "@/lib/ai/shared-model-registry";

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

    const sharedRegistry = await syncSharedApprovedModelRegistry();
    await admin.repository.addAuditLog({
      admin_user_id: admin.user.id,
      action: "AI 모델 목록 갱신 및 공통 승인 목록 동기화",
      target_type: "AI_MODEL",
      target_id: null,
      reason: null,
      metadata: {
        catalogModelCount: catalog.catalogIds.length,
        observedAt: catalog.observedAt,
        sharedRegistrySource: sharedRegistry.source,
        sharedRegistryCheckedAt: sharedRegistry.checkedAt,
        approved: sharedRegistry.approved,
        revoked: sharedRegistry.revoked,
      },
    });

    return Response.json({
      success: true,
      catalogModelCount: catalog.catalogIds.length,
      observedAt: catalog.observedAt,
      sharedRegistry,
    });
  } catch (error) {
    console.warn("Admin shared model registry refresh failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
    });
    return Response.json(
      { success: false, error: "모델 목록 갱신 및 공통 승인 목록 동기화에 실패했습니다." },
      { status: 503 },
    );
  }
}
