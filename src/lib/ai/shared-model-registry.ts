import "server-only";

const DEFAULT_SHARED_REGISTRY_URL =
  "https://siheomon-study-app-six.vercel.app/api/model-registry/approved";

type SharedModelHealth = {
  score: number;
  successRate: number;
  averageLatencyMs: number | null;
  circuitOpenUntil: string | null;
  checkedAt: string | null;
};

type SharedApprovedModel = {
  modelId: string;
  developerCompany: string;
  countryOfHeadquarters: string;
  capabilities: string[];
  health: SharedModelHealth;
};

type SharedRegistryPayload = {
  success?: unknown;
  schemaVersion?: unknown;
  source?: unknown;
  checkedAt?: unknown;
  modelCount?: unknown;
  models?: unknown;
};

type LocalRegistryRow = {
  model_id?: unknown;
  production_approved?: unknown;
  evaluation_profile_json?: unknown;
};

export type SharedModelRegistrySyncResult = {
  source: "siheomon";
  checkedAt: string | null;
  approved: number;
  revoked: number;
  modelIds: string[];
};

export async function syncSharedApprovedModelRegistry(): Promise<SharedModelRegistrySyncResult> {
  const snapshot = await fetchSharedApprovedModelRegistry();
  const { supabaseUrl, secretKey } = readRegistryConfig();
  const sharedIds = new Set(snapshot.models.map((model) => model.modelId));

  const currentResponse = await fetch(
    `${supabaseUrl}/rest/v1/model_registry?select=model_id,production_approved,evaluation_profile_json&provider=eq.nvidia`,
    {
      headers: { apikey: secretKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!currentResponse.ok) {
    throw new Error(`LOCAL_MODEL_REGISTRY_READ_${currentResponse.status}`);
  }

  const currentRows = (await currentResponse.json()) as LocalRegistryRow[];
  const currentById = new Map(
    currentRows
      .filter((row): row is LocalRegistryRow & { model_id: string } => typeof row.model_id === "string")
      .map((row) => [row.model_id.trim(), row]),
  );
  const currentApprovedIds = currentRows
    .filter((row) => row.production_approved === true)
    .map((row) => (typeof row.model_id === "string" ? row.model_id.trim() : ""))
    .filter(Boolean);
  const revokedIds = currentApprovedIds.filter((modelId) => !sharedIds.has(modelId));

  for (const modelId of revokedIds) {
    await patchLocalModel(supabaseUrl, secretKey, modelId, {
      enabled: false,
      approved_model: false,
      production_approved: false,
      updated_at: new Date().toISOString(),
    });
  }

  for (const model of snapshot.models) {
    const previousEvaluation = isRecord(currentById.get(model.modelId)?.evaluation_profile_json)
      ? currentById.get(model.modelId)!.evaluation_profile_json as Record<string, unknown>
      : {};
    const evaluationProfile = {
      ...previousEvaluation,
      sharedRegistrySource: "siheomon",
      modelHealth: model.health,
    };
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
      evaluation_profile_json: evaluationProfile,
      updated_at: new Date().toISOString(),
    };

    const updated = await patchLocalModel(supabaseUrl, secretKey, model.modelId, body);
    if (!updated) {
      const insertResponse = await fetch(`${supabaseUrl}/rest/v1/model_registry`, {
        method: "POST",
        headers: {
          apikey: secretKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          model_id: model.modelId,
          ...body,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!insertResponse.ok) {
        throw new Error(`LOCAL_MODEL_REGISTRY_INSERT_${insertResponse.status}`);
      }
    }
  }

  return {
    source: "siheomon",
    checkedAt: snapshot.checkedAt,
    approved: snapshot.models.length,
    revoked: revokedIds.length,
    modelIds: snapshot.models.map((model) => model.modelId),
  };
}

async function fetchSharedApprovedModelRegistry(): Promise<{
  checkedAt: string | null;
  models: SharedApprovedModel[];
}> {
  const endpoint = (
    process.env.SHARED_MODEL_REGISTRY_URL?.trim() || DEFAULT_SHARED_REGISTRY_URL
  ).replace(/\/$/, "");
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`SHARED_MODEL_REGISTRY_${response.status}`);

  const payload = (await response.json()) as SharedRegistryPayload;
  if (payload.success !== true || !Array.isArray(payload.models)) {
    throw new Error("SHARED_MODEL_REGISTRY_INVALID_PAYLOAD");
  }

  const models = payload.models
    .map(parseSharedModel)
    .filter((model): model is SharedApprovedModel => model !== null);
  if (!models.length) throw new Error("SHARED_MODEL_REGISTRY_EMPTY");

  return {
    checkedAt: typeof payload.checkedAt === "string" ? payload.checkedAt : null,
    models,
  };
}

function parseSharedModel(value: unknown): SharedApprovedModel | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.modelId !== "string" ||
    typeof value.developerCompany !== "string" ||
    typeof value.countryOfHeadquarters !== "string" ||
    !Array.isArray(value.capabilities)
  ) {
    return null;
  }
  const capabilities = value.capabilities.filter(
    (item): item is string => typeof item === "string",
  );
  if (!capabilities.includes("korean") || !capabilities.includes("structured_output")) {
    return null;
  }
  const healthValue = isRecord(value.health) ? value.health : {};
  return {
    modelId: value.modelId.trim(),
    developerCompany: value.developerCompany.trim(),
    countryOfHeadquarters: value.countryOfHeadquarters.trim(),
    capabilities,
    health: {
      score: boundedNumber(healthValue.score, 0.5),
      successRate: boundedNumber(healthValue.successRate, 0.5),
      averageLatencyMs:
        typeof healthValue.averageLatencyMs === "number" && Number.isFinite(healthValue.averageLatencyMs)
          ? healthValue.averageLatencyMs
          : null,
      circuitOpenUntil:
        typeof healthValue.circuitOpenUntil === "string" && healthValue.circuitOpenUntil.trim()
          ? healthValue.circuitOpenUntil
          : null,
      checkedAt:
        typeof healthValue.checkedAt === "string" && healthValue.checkedAt.trim()
          ? healthValue.checkedAt
          : null,
    },
  };
}

async function patchLocalModel(
  supabaseUrl: string,
  secretKey: string,
  modelId: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const query = new URLSearchParams({
    model_id: `eq.${modelId}`,
    provider: "eq.nvidia",
    select: "model_id",
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/model_registry?${query}`, {
    method: "PATCH",
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`LOCAL_MODEL_REGISTRY_PATCH_${response.status}`);
  const rows = (await response.json()) as LocalRegistryRow[];
  return rows.length > 0;
}

function readRegistryConfig(): { supabaseUrl: string; secretKey: string } {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)
    ?.trim()
    .replace(/\/$/, "");
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase Model Registry 연결 환경변수가 설정되지 않았습니다.");
  }
  return { supabaseUrl, secretKey };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}
