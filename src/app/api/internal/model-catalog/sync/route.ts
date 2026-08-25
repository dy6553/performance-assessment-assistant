import { refreshModelCatalog } from "@/lib/ai/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return Response.json({ success: false }, { status: 401 });
  }

  try {
    const result = await refreshModelCatalog();
    return Response.json({
      success: true,
      catalogModelCount: result.catalogIds.length,
      registrySynced: result.synced,
      observedAt: result.observedAt,
    });
  } catch {
    return Response.json(
      { success: false, error: "MODEL_CATALOG_REFRESH_FAILED" },
      { status: 503 },
    );
  }
}
