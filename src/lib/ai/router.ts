import "server-only";

import { headers } from "next/headers";

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
  subjectAffinity: readonly string[];
  formatAffinity: readonly string[];
  difficultyMin: number;
  difficultyMax: number;
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

export type ModelRoutingContext = {
  subject?: string;
  schoolLevel?: string;
  grade?: number;
  assignmentType?: string;
  format?: string;
  difficulty?: number;
};

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
  preferSpeed,
  context = {},
}: {
  task: AgentTask;
  inputCharacters?: number;
  preferSpeed?: boolean;
  context?: ModelRoutingContext;
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

  const speedPreferred = preferSpeed ?? (await requestPrefersFastResponse());
  const difficulty = normalizeDifficulty(context.difficulty ?? inferDifficulty(context, task, inputCharacters));
  const subjectGroup = classifySubject(context.subject);
  const formatGroup = classifyFormat(context.assignmentType, context.format);
  const preferHigh =
    !speedPreferred &&
    (difficulty >= 5 || task === "logic_critic" || task === "final_rewriter" || inputCharacters > 24_000);

  const ranked = [...candidates].sort((a, b) => {
    const scoreDifference =
      scoreModel(b, { task, difficulty, subjectGroup, formatGroup, preferHigh, speedPreferred, inputCharacters }) -
      scoreModel(a, { task, difficulty, subjectGroup, formatGroup, preferHigh, speedPreferred, inputCharacters });
    if (scoreDifference !== 0) return scoreDifference;
    return b.priority - a.priority;
  });

  const selected = ranked[0];
  if (!selected) throw new Error("승인된 NVIDIA 모델 후보가 없습니다.");

  const fallback = ranked.find((model) => model.id !== selected.id)?.id ?? null;

  const contextSummary = [
    context.subject ? `과목 ${context.subject}` : null,
    `난이도 ${difficulty}/7`,
    formatGroup !== "general" ? `형식 ${formatGroup}` : null,
    context.schoolLevel && context.grade ? `${context.schoolLevel} ${context.grade}학년` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    model: selected.id,
    fallback,
    reason: [
      "Supabase Model Registry에서 승인 Provider/Model, 비중국계, 학생 데이터 정책, 보안·개인정보 검토, production approval을 Hard Filter로 적용했습니다.",
      `${contextSummary || "기본 과제 조건"}과 현재 작업 단계(${task})를 함께 점수화해 모델을 선택했습니다.`,
      speedPreferred
        ? "빠른 응답 모드가 켜져 있어 효율성과 task affinity에 가중치를 높였습니다."
        : preferHigh
          ? "고난도·검증·장문 작업이라 고품질·추론·장문 처리 능력에 가중치를 높였습니다."
          : "현재 난이도와 형식에 맞춰 효율성과 품질의 균형을 우선했습니다.",
      availability.live
        ? availability.catalogSynced
          ? "NVIDIA 실시간 모델 카탈로그와 교집합을 확인했고 새 모델은 검증 대기 후보로 자동 동기화했습니다."
          : "NVIDIA 실시간 모델 카탈로그는 확인했지만 후보 Registry 동기화는 실패해 다음 실행에서 재시도합니다."
        : "사용자 요청 경로에서는 승인 Registry를 즉시 사용하고 모델 카탈로그 갱신은 예약 작업에서 수행합니다.",
    ].join(" "),
    registryPolicy: "hard-filtered",
    registrySource: "supabase",
    liveCatalogChecked: availability.live,
  };
}

function scoreModel(
  model: ModelRecord,
  context: {
    task: AgentTask;
    difficulty: number;
    subjectGroup: string;
    formatGroup: string;
    preferHigh: boolean;
    speedPreferred: boolean;
    inputCharacters: number;
  },
): number {
  let score = model.priority;

  if (model.taskAffinity.includes(context.task)) score += 120;
  else if (model.taskAffinity.length > 0) score -= 25;

  if (context.preferHigh && model.quality === "high") score += 55;
  if (!context.preferHigh && model.quality === "efficient") score += 35;
  if (context.speedPreferred && model.quality === "efficient") score += 30;

  if (context.difficulty >= model.difficultyMin && context.difficulty <= model.difficultyMax) score += 28;
  else score -= Math.min(30, Math.abs(context.difficulty - clamp(context.difficulty, model.difficultyMin, model.difficultyMax)) * 8);

  if (model.subjectAffinity.includes(context.subjectGroup) || model.subjectAffinity.includes("all")) score += 24;
  if (model.formatAffinity.includes(context.formatGroup) || model.formatAffinity.includes("all")) score += 22;

  const reasoningHeavy =
    context.difficulty >= 5 ||
    context.task === "logic_critic" ||
    context.task === "curriculum_verifier" ||
    context.subjectGroup === "stem";
  if (reasoningHeavy && model.capabilities.includes("reasoning")) score += 28;

  const longForm =
    context.inputCharacters > 18_000 ||
    context.formatGroup === "report" ||
    context.formatGroup === "presentation" ||
    context.formatGroup === "experiment";
  if (longForm && model.capabilities.includes("long_context")) score += 18;

  return score;
}

function inferDifficulty(context: ModelRoutingContext, task: AgentTask, inputCharacters: number): number {
  let difficulty = context.schoolLevel === "고등학교" ? 4 : context.schoolLevel === "중학교" ? 3 : 2;
  if (typeof context.grade === "number") difficulty += Math.max(0, Math.min(2, context.grade - 1)) * 0.5;
  if (task === "logic_critic" || task === "final_rewriter") difficulty += 1.5;
  else if (task === "writer" || task === "strategy") difficulty += 0.7;
  if (classifySubject(context.subject) === "stem") difficulty += 0.5;
  if (["report", "presentation", "experiment"].includes(classifyFormat(context.assignmentType, context.format))) difficulty += 0.5;
  if (inputCharacters > 24_000) difficulty += 0.7;
  return Math.round(difficulty);
}

function classifySubject(subject?: string): string {
  const normalized = (subject ?? "").replace(/\s+/g, "").toLowerCase();
  if (!normalized) return "general";
  if (/(수학|과학|물리|화학|생명|지구|정보|컴퓨터|과학탐구)/.test(normalized)) return "stem";
  if (/(사회|역사|한국사|세계사|지리|경제|정치|법|윤리)/.test(normalized)) return "social";
  if (/(국어|영어|문학|언어|한문|외국어)/.test(normalized)) return "language";
  if (/(미술|음악|체육|예술)/.test(normalized)) return "arts";
  return "general";
}

function classifyFormat(assignmentType?: string, format?: string): string {
  const value = `${assignmentType ?? ""} ${format ?? ""}`.toLowerCase();
  if (/(실험|탐구|관찰)/.test(value)) return "experiment";
  if (/(발표|토론|프레젠테이션|슬라이드)/.test(value)) return "presentation";
  if (/(보고서|논술|에세이|서술)/.test(value)) return "report";
  if (/(주제|추천)/.test(value)) return "topic";
  return "general";
}

function normalizeDifficulty(value: number): number {
  if (!Number.isFinite(value)) return 4;
  return clamp(Math.round(value), 1, 7);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export async function refreshModelCatalog(): Promise<ModelCatalogRefresh> {
  const apiKey = (process.env.NVIDIA_API_KEY || process.env.Nvidia_key)?.trim();
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

async function requestPrefersFastResponse(): Promise<boolean> {
  try {
    const requestHeaders = await headers();
    return requestHeaders.get("x-assessment-fast-response") === "1";
  } catch {
    return false;
  }
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
  const subjectAffinity = parseStringArray(evaluation.subjectAffinity);
  const formatAffinity = parseStringArray(evaluation.formatAffinity);
  const difficultyMin = normalizeDifficultyNumber(evaluation.difficultyMin, 1);
  const difficultyMax = normalizeDifficultyNumber(evaluation.difficultyMax, 7);

  return {
    id: row.model_id.trim(),
    developer: row.developer_company.trim(),
    headquarters: row.country_of_headquarters.trim(),
    capabilities,
    quality,
    priority,
    taskAffinity,
    subjectAffinity,
    formatAffinity,
    difficultyMin: Math.min(difficultyMin, difficultyMax),
    difficultyMax: Math.max(difficultyMin, difficultyMax),
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

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim().toLowerCase()).filter(Boolean)
    : [];
}

function normalizeDifficultyNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? normalizeDifficulty(value) : fallback;
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

  try {
    const catalog = await refreshModelCatalog();
    availabilityCache = {
      ids: new Set(catalog.catalogIds),
      expiresAt: now + 5 * 60 * 1_000,
      live: true,
      catalogSynced: catalog.synced,
    };
  } catch (error) {
    console.warn("NVIDIA 실시간 모델 카탈로그 확인 실패", {
      errorCode: safeServiceErrorCode(error),
    });
    availabilityCache = {
      ids: new Set(registry.map((model) => model.id)),
      expiresAt: now + 60 * 1_000,
      live: false,
      catalogSynced: false,
    };
  }
  return availabilityCache;
}

function safeServiceErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  return message.match(/(?:NVIDIA|SUPABASE)_\d{3}/i)?.[0]?.toUpperCase() ?? "UNKNOWN";
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
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)
    ?.trim()
    .replace(/\/$/, "");
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  if (!supabaseUrl || !secretKey) {
    throw new Error("Supabase Model Registry 연결 환경변수가 설정되지 않았습니다.");
  }
  return { supabaseUrl, secretKey };
}
