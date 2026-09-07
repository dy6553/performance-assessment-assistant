import { autoReviewDailyModelCatalog } from "@/lib/ai/model-auto-approval";
import { refreshModelCatalog } from "@/lib/ai/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false }, { status: 401 });
  }

  try {
    const result = await refreshModelCatalog();
    const autoApproval = result.synced
      ? await autoReviewDailyModelCatalog(result.catalogIds)
      : null;

    return Response.json({
      success: true,
      catalogModelCount: result.catalogIds.length,
      registrySynced: result.synced,
      observedAt: result.observedAt,
      autoApproval,
    });
  } catch (error) {
    console.warn("Daily model catalog sync/approval failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
    });
    return Response.json(
      { success: false, error: "MODEL_CATALOG_REFRESH_FAILED" },
      { status: 503 },
    );
  }
}
