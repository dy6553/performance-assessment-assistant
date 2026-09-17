const isProduction = process.env.VERCEL_ENV === "production";
if (!isProduction) {
  console.log("[shared-registry-sync] skipped outside production");
  process.exit(0);
}

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL || "")
  .trim()
  .replace(/\/$/, "");
const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key || "").trim();
const sharedUrl = (
  process.env.SHARED_MODEL_REGISTRY_URL ||
  "https://siheomon-study-app-six.vercel.app/api/model-registry/approved"
).replace(/\/$/, "");

if (!supabaseUrl || !secretKey) {
  throw new Error("[shared-registry-sync] Supabase production credentials are unavailable");
}

const sharedResponse = await fetch(sharedUrl, {
  headers: { Accept: "application/json" },
  signal: AbortSignal.timeout(20_000),
});
if (!sharedResponse.ok) {
  throw new Error(`[shared-registry-sync] central registry HTTP ${sharedResponse.status}`);
}
const shared = await sharedResponse.json();
if (shared?.success !== true || !Array.isArray(shared.models) || shared.models.length === 0) {
  throw new Error("[shared-registry-sync] invalid central registry payload");
}

const models = shared.models.filter(
  (model) =>
    typeof model?.modelId === "string" &&
    typeof model?.developerCompany === "string" &&
    typeof model?.countryOfHeadquarters === "string" &&
    Array.isArray(model?.capabilities) &&
    model.capabilities.includes("korean") &&
    model.capabilities.includes("structured_output"),
);
if (models.length !== shared.models.length) {
  throw new Error("[shared-registry-sync] central registry contains invalid model entries");
}

const baseHeaders = { apikey: secretKey, Accept: "application/json" };
const currentResponse = await fetch(
  `${supabaseUrl}/rest/v1/model_registry?select=model_id&provider=eq.nvidia&production_approved=eq.true`,
  { headers: baseHeaders, signal: AbortSignal.timeout(10_000) },
);
if (!currentResponse.ok) {
  throw new Error(`[shared-registry-sync] local registry read HTTP ${currentResponse.status}`);
}
const current = await currentResponse.json();
const sharedIds = new Set(models.map((model) => model.modelId));
const revokeIds = current
  .map((row) => (typeof row?.model_id === "string" ? row.model_id.trim() : ""))
  .filter((id) => id && !sharedIds.has(id));

async function patchModel(modelId, body) {
  const query = new URLSearchParams({
    model_id: `eq.${modelId}`,
    provider: "eq.nvidia",
    select: "model_id",
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/model_registry?${query}`, {
    method: "PATCH",
    headers: {
      ...baseHeaders,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`[shared-registry-sync] patch HTTP ${response.status}`);
  return await response.json();
}

for (const modelId of revokeIds) {
  await patchModel(modelId, {
    enabled: false,
    approved_model: false,
    production_approved: false,
    updated_at: new Date().toISOString(),
  });
}

for (const model of models) {
  const body = {
    provider: "nvidia",
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
  const updated = await patchModel(model.modelId, body);
  if (updated.length === 0) {
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/model_registry`, {
      method: "POST",
      headers: {
        ...baseHeaders,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        model_id: model.modelId,
        ...body,
        evaluation_profile_json: { sharedRegistrySource: "siheomon" },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!insertResponse.ok) {
      throw new Error(`[shared-registry-sync] insert HTTP ${insertResponse.status}`);
    }
  }
}

console.log(
  `[shared-registry-sync] approved=${models.length} revoked=${revokeIds.length} source=siheomon`,
);
