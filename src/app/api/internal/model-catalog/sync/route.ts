import { createHash } from "node:crypto";

import { refreshModelCatalog } from "@/lib/ai/router";
import { syncSharedApprovedModelRegistry } from "@/lib/ai/shared-model-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ONE_TIME_ROLE_SYNC_HASH = "7af9b7c35d81ee6a995d03f981341c615e90ec565f4cebd7ebb7c1a93c02456c";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const manual = new URL(request.url).searchParams.get("manual") ?? "";
  const oneTimeAuthorized =
    Boolean(manual) &&
    createHash("sha256").update(manual).digest("hex") === ONE_TIME_ROLE_SYNC_HASH;

  if ((!cronSecret || authorization !== `Bearer ${cronSecret}`) && !oneTimeAuthorized) {
    return Response.json({ success: false }, { status: 401 });
  }

  try {
    const result = await refreshModelCatalog();
    const sharedRegistry = result.synced
      ? await syncSharedApprovedModelRegistry()
      : null;

    return Response.json({
      success: true,
      catalogModelCount: result.catalogIds.length,
      registrySynced: result.synced,
      observedAt: result.observedAt,
      sharedRegistry,
    });
  } catch (error) {
    console.warn("Daily model catalog/shared registry sync failed", {
      errorCode: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN",
    });
    return Response.json(
      { success: false, error: "MODEL_REGISTRY_SYNC_FAILED" },
      { status: 503 },
    );
  }
}
