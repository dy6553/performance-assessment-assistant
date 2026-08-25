import "server-only";

export type AgentTask =
  | "task_parser"
  | "strategy"
  | "writer"
  | "logic_critic"
  | "curriculum_verifier"
  | "rubric_grader"
  | "final_rewriter";

type ModelRecord = {
  id: string;
  developer: string;
  headquarters: string;
  approved: boolean;
  productionApproved: boolean;
  chineseOriginExcluded: boolean;
  capabilities: readonly string[];
  quality: "efficient" | "high";
};

const REGISTRY: readonly ModelRecord[] = [
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    developer: "NVIDIA Corporation",
    headquarters: "United States",
    approved: true,
    productionApproved: true,
    chineseOriginExcluded: true,
    capabilities: ["korean", "reasoning", "structured_output", "long_context"],
    quality: "efficient",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    developer: "NVIDIA Corporation",
    headquarters: "United States",
    approved: true,
    productionApproved: true,
    chineseOriginExcluded: true,
    capabilities: ["korean", "reasoning", "structured_output", "long_context"],
    quality: "high",
  },
] as const;

const APPROVED_IDS = new Set(REGISTRY.filter(isEligible).map((model) => model.id));

type AvailabilityCache = { ids: Set<string>; expiresAt: number; live: boolean };
let availabilityCache: AvailabilityCache | undefined;

export type ModelRoute = {
  model: string;
  fallback: string | null;
  reason: string;
  registryPolicy: "hard-filtered";
  liveCatalogChecked: boolean;
};

export async function routeModel({
  task,
  inputCharacters = 0,
}: {
  task: AgentTask;
  inputCharacters?: number;
}): Promise<ModelRoute> {
  const availability = await getAvailableApprovedModels();
  const available = REGISTRY.filter(
    (record) => isEligible(record) && availability.ids.has(record.id),
  );
  const candidates = available.length ? available : REGISTRY.filter(isEligible);

  const preferHigh =
    task === "strategy" ||
    task === "writer" ||
    task === "curriculum_verifier" ||
    task === "rubric_grader" ||
    task === "final_rewriter" ||
    inputCharacters > 24_000;

  const envPreferred = preferHigh
    ? process.env.NVIDIA_MODEL_REASONING?.trim()
    : process.env.NVIDIA_MODEL_FAST?.trim();
  const safeEnvPreferred = envPreferred && APPROVED_IDS.has(envPreferred) ? envPreferred : null;

  const selected =
    candidates.find((model) => model.id === safeEnvPreferred) ??
    candidates.find((model) => model.quality === (preferHigh ? "high" : "efficient")) ??
    candidates[0];

  if (!selected) throw new Error("승인된 NVIDIA 모델 후보가 없습니다.");

  const fallback = candidates.find((model) => model.id !== selected.id)?.id ?? null;

  return {
    model: selected.id,
    fallback,
    reason: [
      "승인 Provider/Model, 비중국계 정책, 필수 capability를 Hard Filter로 먼저 적용했습니다.",
      preferHigh
        ? "정확도·긴 문맥·추론 품질이 중요한 작업이라 고품질 모델을 우선했습니다."
        : "구조화 분석 중심 작업이라 검증된 효율 모델을 우선했습니다.",
      availability.live
        ? "현재 NVIDIA 모델 카탈로그 노출 여부도 확인했습니다."
        : "실시간 카탈로그 확인 실패 시 사전 승인 allowlist만 사용했습니다.",
    ].join(" "),
    registryPolicy: "hard-filtered",
    liveCatalogChecked: availability.live,
  };
}

function isEligible(record: ModelRecord): boolean {
  return (
    record.approved === true &&
    record.productionApproved === true &&
    record.chineseOriginExcluded === true &&
    record.headquarters.trim().toLowerCase() !== "china" &&
    record.capabilities.includes("korean") &&
    record.capabilities.includes("structured_output")
  );
}

async function getAvailableApprovedModels(now = Date.now()): Promise<AvailabilityCache> {
  if (availabilityCache && availabilityCache.expiresAt > now) return availabilityCache;

  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    return {
      ids: new Set(APPROVED_IDS),
      expiresAt: now + 60_000,
      live: false,
    };
  }

  const baseUrl = (process.env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error("catalog unavailable");
    const payload = (await response.json()) as { data?: Array<{ id?: unknown }> };
    const liveIds = new Set(
      (payload.data ?? [])
        .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
        .filter((id) => APPROVED_IDS.has(id)),
    );
    if (!liveIds.size) throw new Error("no approved models in catalog");
    availabilityCache = { ids: liveIds, expiresAt: now + 6 * 60 * 60 * 1_000, live: true };
  } catch {
    availabilityCache = {
      ids: new Set(APPROVED_IDS),
      expiresAt: now + 15 * 60 * 1_000,
      live: false,
    };
  }
  return availabilityCache;
}
