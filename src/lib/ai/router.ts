import "server-only";

export type AgentTask =
  | "task_parser"
  | "strategy"
  | "writer"
  | "logic_critic"
  | "curriculum_verifier"
  | "rubric_grader"
  | "final_rewriter";

type QualityTier = "efficient" | "high";

type ModelRecord = {
  id: string;
  developer: string;
  headquarters: string;
  capabilities: readonly string[];
  quality: QualityTier;
  priority: number;
  taskAffinity: readonly AgentTask[];
};

type RegistryRow = {
  model_id?: unknown;
  provider?: unknown;
  enabled?: unknown;
  developer_company?: unknown;
  country_of_headquarters?: unknown;
  china_origin_excluded?: unknown;
  approved_provider?: unknown;
  approved_model?: unknown;
  allowed_for_student_data?: unknown;
  training_on_api_data?: unknown;
  security_review_passed?: unknown;
  privacy_policy_verified?: unknown;
  deprecated?: unknown;
  capabilities_json?: unknown;
  evaluation_profile_json?: unknown;
  production_approved?: unknown;
};

type RegistryCache = { records: ModelRecord[]; expiresAt: number };
type AvailabilityCache = {
  ids: Set<string>;
  expiresAt: number;
  live: boolean;
  catalogSynced: boolean;
};

let registryCache: RegistryCache | undefined;
let availabilityCache: AvailabilityCache | undefined;

export type ModelRoute = {
  model: string;
  fallback: string | null;
  reason: string;
  registryPolicy: "hard-filtered";
  registrySource: "supabase";
  liveCatalogChecked: boolean;
};

export type ModelCatalogRefresh = {
  catalogIds: string[];
  synced: boolean;
  observedAt: string;
};

export async function routeModel({
  task,
  inputCharacters = 0,
}: {
  task: AgentTask;
  inputCharacters?: number;
}): Promise<ModelRoute> {
  const registry = await loadApprovedRegistry();
  if (!registry.length) {
    throw new Error("승인된 AI 모델이 Model Registry에 없습니다.");
  }

  const availability = await getAvailableApprovedModels(registry);
  const candidates = availability.live
    ? registry.filter((record) => availability.ids.has(record.id))
    : registry;

  if (!candidates.length) {
    throw new Error("현재 NVIDIA API에서 사용 가능한 승인 모델이 없습니다.");
  }

  const preferHigh = task !== "task_parser" || inputCharacters > 24_000;

  const ranked = [...candidates].sort((a, b) => {
    const aAffinity = a.taskAffinity.includes(task) ? 1 : 0;
    const bAffinity = b.taskAffinity.includes(task) ? 1 : 0;
    if (aAffinity !== bAffinity) return bAffinity - aAffinity;

    const desiredTier: QualityTier = preferHigh ? "high" : "efficient";
    const aTier = a.quality === desiredTier ? 1 : 0;
    const bTier = b.quality === desiredTier ? 1 : 0;
    if (aTier !== bTier) return bTier - aTier;

    return b.priority - a.priority;
  });

  const selected = ranked[0];
  if (!selected) throw new Error("승인된 NVIDIA 모델 후보가 없습니다.");

  const fallback = ranked.find((model) => model.id !== selected.id)?.id ?? null;

  return {
    model: selected.id,
    fallback,
    reason: [
      "Supabase Model Registry에서 승인 Provider/Model, 비중국계, 학생 데이터 정책, 보안·개인정보 검토, production approval을 Hard Filter로 적용했습니다.",
      preferHigh
        ? "정확도 우선 작업이라 고품질 tier와 task affinity를 우선했습니다."
        : "구조화 분석 작업이라 검증된 효율 tier를 우선했습니다.",
      availability.live
        ? availability.catalogSynced
          ? "NVIDIA 실시간 모델 카탈로그와 교집합을 확인했고 새 모델은 검증 대기 후보로 자동 동기화했습니다."
          : "NVIDIA 실시간 모델 카탈로그는 확인했지만 후보 Registry 동기화는 실패해 다음 실행에서 재시도합니다."
        : "실시간 카탈로그 확인 실패 시 DB의 사전 승인 Registry만 사용했습니다.",
    ].join(" "),
    registryPolicy: "hard-filtered",
    registrySource: "supabase",
    liveCatalogChecked: availability.live,
  };
}

export async function refreshModelCatalog(): Promise<ModelCatalogRefresh> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) throw new Error("NVIDIA_API_KEY가 설정되지 않았습니다.");

  const baseUrl = (process.env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA 모델 카탈로그 조회에 실패했습니다. (NVIDIA_${response.status})`);
  }

  const payload = (await response.json()) as { data?: Array<{ id?: unknown }> };
  const catalogIds = Array.from(
    new Set(
      (payload.data ?? [])
        .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
        .filter(Boolean),
    ),
  );

  if (!catalogIds.length) {
    throw new Error("NVIDIA 모델 카탈로그가 비어 있습니다.");
  }

  const observedAt = new Date().toISOString();
  const synced = await syncCatalogCandidates(catalogIds, observedAt);
  return { catalogIds, synced, observedAt };
}

async function loadApprovedRegistry(now = Date.now()): Promise<ModelRecord[]> {
  if (registryCache && registryCache.expiresAt > now) return registryCache.records;

  const { supabaseUrl, secretKey } = readRegistryConfig();
  const query = new URLSearchParams({
    select: [
      "model_id",
      "provider",
      "enabled",
      "developer_company",
      "country_of_headquarters",
      "china_origin_excluded",
      "approved_provider",
      "approved_model",
      "allowed_for_student_data",
      "training_on_api_data",
      "security_review_passed",
      "privacy_policy_verified",
      "deprecated",
      "capabilities_json",
      "evaluation_profile_json",
      "production_approved",
    ].join(","),
    provider: "eq.nvidia",
    enabled: "eq.true",
    production_approved: "eq.true",
    deprecated: "eq.false",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/model_registry?${query}`, {
    headers: {
      apikey: secretKey,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Model Registry 조회에 실패했습니다. (SUPABASE_${response.status})`);
  }

  const rows = (await response.json()) as RegistryRow[];
  const records = rows.map(toModelRecord).filter((record): record is ModelRecord => record !== null);

  if (!records.length) {
    throw new Error("Model Registry Hard Filter를 통과한 모델이 없습니다.");
  }

  registryCache = { records, expiresAt: now + 5 * 60 * 1_000 };
  return records;
}

function toModelRecord(row: RegistryRow): ModelRecord | null {
  if (
    row.provider !== "nvidia" ||
    row.enabled !== true ||
    row.approved_provider !== true ||
    row.approved_model !== true ||
    row.china_origin_excluded !== true ||
    row.allowed_for_student_data !== true ||
    row.training_on_api_data !== false ||
    row.security_review_passed !== true ||
    row.privacy_policy_verified !== true ||
    row.production_approved !== true ||
    row.deprecated === true ||
    typeof row.model_id !== "string" ||
    typeof row.developer_company !== "string" ||
    typeof row.country_of_headquarters !== "string" ||
    row.country_of_headquarters.trim().toLowerCase() === "china"
  ) {
    return null;
  }

  const capabilities = parseCapabilities(row.capabilities_json);
  if (!capabilities.includes("korean") || !capabilities.includes("structured_output")) {
    return null;
  }

  const evaluation = isRecord(row.evaluation_profile_json) ? row.evaluation_profile_json : {};
  const quality: QualityTier = evaluation.qualityTier === "high" ? "high" : "efficient";
  const priority =
    typeof evaluation.priority === "number" && Number.isFinite(evaluation.priority)
      ? evaluation.priority
      : 0;
  const taskAffinity = Array.isArray(evaluation.taskAffinity)
    ? evaluation.taskAffinity.filter(isAgentTask)
    : [];

  return {
    id: row.model_id.trim(),
    developer: row.developer_company.trim(),
    headquarters: row.country_of_headquarters.trim(),
    capabilities,
    quality,
    priority,
    taskAffinity,
  };
}

function parseCapabilities(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => name);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAgentTask(value: unknown): value is AgentTask {
  return (
    value === "task_parser" ||
    value === "strategy" ||
    value === "writer" ||
    value === "logic_critic" ||
    value === "curriculum_verifier" ||
    value === "rubric_grader" ||
    value === "final_rewriter"
  );
}

async function getAvailableApprovedModels(
  registry: readonly ModelRecord[],
  now = Date.now(),
): Promise<AvailabilityCache> {
  if (availabilityCache && availabilityCache.expiresAt > now) return availabilityCache;

  const approvedIds = new Set(registry.map((model) => model.id));

  try {
    const refresh = await refreshModelCatalog();
    const liveIds = new Set(refresh.catalogIds.filter((id) => approvedIds.has(id)));
    availabilityCache = {
      ids: liveIds,
      expiresAt: now + 60 * 60 * 1_000,
      live: true,
      catalogSynced: refresh.synced,
    };
  } catch {
    availabilityCache = {
      ids: approvedIds,
      expiresAt: now + 10 * 60 * 1_000,
      live: false,
      catalogSynced: false,
    };
  }

  return availabilityCache;
}

async function syncCatalogCandidates(
  catalogIds: readonly string[],
  observedAt: string,
): Promise<boolean> {
  if (!catalogIds.length) return false;

  try {
    const { supabaseUrl, secretKey } = readRegistryConfig();
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_nvidia_model_catalog`, {
      method: "POST",
      headers: {
        apikey: secretKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        catalog_model_ids: catalogIds,
        observed_at: observedAt,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`NVIDIA 후보 모델 동기화 실패: SUPABASE_${response.status}`);
      return false;
    }
    return true;
  } catch {
    console.warn("NVIDIA 후보 모델 동기화를 완료하지 못했습니다.");
    return false;
  }
}

function readRegistryConfig(): { supabaseUrl: string; secretKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase Model Registry 연결 환경변수가 설정되지 않았습니다.");
  }
  return { supabaseUrl, secretKey };
}
