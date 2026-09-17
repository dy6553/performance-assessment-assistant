const SHARED_URL = (process.env.SHARED_MODEL_REGISTRY_URL || "https://siheomon-study-app-six.vercel.app/api/model-registry/approved").replace(/\/$/, "");
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL || "").trim().replace(/\/$/, "");
const SUPABASE_KEY = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key || "").trim();

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Accept: "application/json",
    ...(SUPABASE_KEY.split(".").length === 3 ? { Authorization: `Bearer ${SUPABASE_KEY}` } : {}),
    ...extra,
  };
}

async function patch(modelId, body) {
  const query = new URLSearchParams({ model_id: `eq.${modelId}`, provider: "eq.nvidia", select: "model_id" });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/model_registry?${query}`, {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`PATCH_${modelId}_${response.status}`);
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function insert(model, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/model_registry`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify({
      model_id: model.modelId,
      provider: "nvidia",
      ...body,
      evaluation_profile_json: { sharedRegistrySource: "siheomon" },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`INSERT_${model.modelId}_${response.status}`);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("[shared-registry-sync] skipped: Supabase production environment variables unavailable");
    return;
  }
  const sharedResponse = await fetch(SHARED_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!sharedResponse.ok) throw new Error(`SHARED_${sharedResponse.status}`);
  const payload = await sharedResponse.json();
  if (payload?.success !== true || !Array.isArray(payload.models) || payload.models.length === 0) {
    throw new Error("SHARED_INVALID_PAYLOAD");
  }
  const models = payload.models.filter((model) =>
    typeof model?.modelId === "string" &&
    typeof model?.developerCompany === "string" &&
    typeof model?.countryOfHeadquarters === "string" &&
    Array.isArray(model?.capabilities) &&
    model.capabilities.includes("korean") &&
    model.capabilities.includes("structured_output"),
  );
  if (models.length === 0) throw new Error("SHARED_NO_VALID_MODELS");

  const currentResponse = await fetch(`${SUPABASE_URL}/rest/v1/model_registry?select=model_id&provider=eq.nvidia&production_approved=eq.true`, {
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!currentResponse.ok) throw new Error(`LOCAL_READ_${currentResponse.status}`);
  const current = await currentResponse.json();
  const sharedIds = new Set(models.map((model) => model.modelId));
  const currentIds = (Array.isArray(current) ? current : []).map((row) => row?.model_id).filter((id) => typeof id === "string");
  const revoked = currentIds.filter((id) => !sharedIds.has(id));

  for (const modelId of revoked) {
    await patch(modelId, {
      enabled: false,
      approved_model: false,
      production_approved: false,
      updated_at: new Date().toISOString(),
    });
  }

  for (const model of models) {
    const body = {
      enabled: true,
      developer_company: model.developerCompany,
      country_of_headquarters: model.countryOfHeadquarters,
      china_origin_excluded: true,
      approved_provider: true,
      approved_model: true,
      allowed_for_student_data: true,
      security_review_passed: true,
      privacy_policy_verified: true,
      deprecated: false,
      capabilities_json: model.capabilities,
      production_approved: true,
      catalog_available: true,
      catalog_source: "shared_siheomon_registry",
      updated_at: new Date().toISOString(),
    };
    const updated = await patch(model.modelId, body);
    if (!updated) await insert(model, body);
  }

  console.log(`[shared-registry-sync] approved=${models.length} revoked=${revoked.length} source=siheomon checkedAt=${payload.checkedAt ?? "unknown"}`);
  console.log(`[shared-registry-sync] models=${models.map((model) => model.modelId).join(",")}`);
}

main().catch((error) => {
  console.error(`[shared-registry-sync] fatal=${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
