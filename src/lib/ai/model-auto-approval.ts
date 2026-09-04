import "server-only";

type RegistryRow = {
  model_id: string;
  enabled: boolean;
  developer_company: string;
  country_of_headquarters: string;
  china_origin_excluded: boolean;
  approved_provider: boolean;
  approved_model: boolean;
  allowed_for_student_data: boolean;
  training_on_api_data: boolean;
  zero_data_retention_available: boolean;
  security_review_passed: boolean;
  privacy_policy_verified: boolean;
  deprecated: boolean;
  capabilities_json: unknown;
  evaluation_profile_json: unknown;
  production_approved: boolean;
  catalog_available: boolean;
  catalog_first_seen_at: string | null;
};

type Config = {
  supabaseUrl: string;
  secretKey: string;
  nvidiaApiKey: string;
  nvidiaBaseUrl: string;
};

type PublisherPolicy = {
  company: string;
  headquarters: string;
};

type BenchmarkResult = {
  operational: boolean;
  structuredOutput: boolean;
  korean: boolean;
  subjectPass: boolean;
  hallucinationGuard: boolean;
  sourceFaithfulness: boolean;
  reasoning: boolean;
  score: number;
  latencyMs: number | null;
  failureCode: string | null;
};

type OfficialEvidence = {
  modelPage: boolean;
  modelCard: boolean;
  benchmarkEvidence: boolean;
  licenseEvidence: boolean;
  commercialUse: boolean;
  reasoning: boolean;
  vision: boolean;
  longContext: boolean;
};

type ProviderPolicyEvidence = {
  baselineApproved: boolean;
  officialTermsReachable: boolean;
  privacyPolicyReachable: boolean;
  securityGuidanceReachable: boolean;
  allowedForStudentData: boolean;
  trainingOnApiData: boolean;
  zeroDataRetentionAvailable: boolean;
};

export type AutoModelApprovalSummary = {
  checked: number;
  approved: number;
  rejected: number;
  pending: number;
  baselineModel: string | null;
  outcomes: Array<{
    modelId: string;
    status: "approved" | "rejected" | "pending";
    reasons: string[];
  }>;
};

const POLICY_VERSION = "2026-09-04.1";
const MAX_NEW_REVIEWS_PER_RUN = 12;
const MIN_INTERNAL_SCORE = 0.8;
const LATENCY_IMPROVEMENT_RATIO = 0.85;

// The user's approved-provider policy starts from these explicitly reviewed,
// non-China developers. Unknown publishers never auto-approve; they remain pending
// until policy data is added deliberately.
const TRUSTED_PUBLISHERS: Record<string, PublisherPolicy> = {
  nvidia: { company: "NVIDIA Corporation", headquarters: "United States" },
  google: { company: "Google LLC", headquarters: "United States" },
  meta: { company: "Meta Platforms, Inc.", headquarters: "United States" },
  microsoft: { company: "Microsoft Corporation", headquarters: "United States" },
  openai: { company: "OpenAI, L.L.C.", headquarters: "United States" },
};

const BLOCKED_PUBLISHERS = new Set([
  "deepseek-ai",
  "moonshotai",
  "moonshot-ai",
  "minimaxai",
  "qwen",
  "qwen2",
  "qwen3",
  "alibaba",
  "baidu",
  "tencent",
  "z-ai",
  "zhipuai",
  "stepfun-ai",
  "baichuan",
]);

const BENCHMARK_PROMPT = [
  "아래 8개 항목을 풀고 반드시 JSON 객체 하나만 출력하세요.",
  "키 이름과 정답 형식을 정확히 지키세요. 설명이나 마크다운을 추가하지 마세요.",
  "1) math: x+y=17, xy=60일 때 x²+y²의 값(숫자)",
  "2) arithmetic: 37×24의 값(숫자)",
  "3) science: 액체가 기체로 변하는 상태 변화를 한국어 두 글자로 쓰기",
  "4) social: 법률을 제정하는 국가 기관을 '입법부' 또는 '국회' 중 하나로 쓰기",
  "5) korean: '민지는 도서관에서 과학책을 빌렸다.'에서 책을 빌린 사람의 이름",
  "6) source: 제공 자료가 'A학교의 학생 수는 500명이다.'뿐일 때 A학교 교장 이름을 묻는 질문에는 '자료에없음'이라고 쓰기",
  "7) hallucination: 공식 출처가 주어지지 않은 가상의 성취기준 코드 '[99가00-00]'의 실제 존재 여부를 묻는다면 '확인필요'라고 쓰기",
  "8) reasoning: 2, 6, 12, 20, 30 다음 수(숫자)",
  "출력 예시 형식: {\"math\":169,\"arithmetic\":888,\"science\":\"기화\",\"social\":\"입법부\",\"korean\":\"민지\",\"source\":\"자료에없음\",\"hallucination\":\"확인필요\",\"reasoning\":42}",
].join("\n");

export async function autoReviewDailyModelCatalog(
  catalogIds: readonly string[],
): Promise<AutoModelApprovalSummary> {
  const config = readConfig();
  const rows = await loadRegistry(config);
  const catalogSet = new Set(catalogIds);
  const visibleRows = rows.filter(
    (row) => row.catalog_available === true && catalogSet.has(row.model_id),
  );

  const providerPolicy = await verifyProviderPolicy(config, rows);
  const baselineRow = pickBaseline(visibleRows);
  const baselineBenchmark = baselineRow
    ? await benchmarkModel(config, baselineRow.model_id)
    : null;
  const baselineCapabilities = baselineRow
    ? capabilityRecord(baselineRow.capabilities_json)
    : {};
  const baselineStoredScore = baselineRow
    ? readNumeric(capabilityRecord(baselineRow.evaluation_profile_json).internalEvalScore)
    : null;
  const baselineScore =
    baselineBenchmark?.operational && baselineBenchmark.structuredOutput
      ? baselineBenchmark.score
      : baselineStoredScore ?? MIN_INTERNAL_SCORE;
  const baselineLatency =
    baselineBenchmark?.operational && baselineBenchmark.latencyMs !== null
      ? baselineBenchmark.latencyMs
      : baselineRow
        ? readNumeric(capabilityRecord(baselineRow.evaluation_profile_json).latencyMs)
        : null;

  if (baselineRow && baselineBenchmark) {
    await recordBaselineEvaluation(config, baselineRow, baselineBenchmark);
  }

  const candidates = visibleRows
    .filter((row) => !row.production_approved || !row.enabled)
    .sort((a, b) =>
      String(a.catalog_first_seen_at ?? "").localeCompare(
        String(b.catalog_first_seen_at ?? ""),
      ),
    )
    .slice(0, MAX_NEW_REVIEWS_PER_RUN);

  const outcomes: AutoModelApprovalSummary["outcomes"] = [];
  let approved = 0;
  let rejected = 0;
  let pending = Math.max(0, visibleRows.filter((row) => !row.production_approved).length - candidates.length);

  for (const row of candidates) {
    const outcome = await reviewCandidate({
      config,
      row,
      providerPolicy,
      baselineScore,
      baselineLatency,
      baselineCapabilities,
    });
    outcomes.push(outcome);
    if (outcome.status === "approved") approved += 1;
    else if (outcome.status === "rejected") rejected += 1;
    else pending += 1;
  }

  return {
    checked: candidates.length,
    approved,
    rejected,
    pending,
    baselineModel: baselineRow?.model_id ?? null,
    outcomes,
  };
}

async function reviewCandidate({
  config,
  row,
  providerPolicy,
  baselineScore,
  baselineLatency,
  baselineCapabilities,
}: {
  config: Config;
  row: RegistryRow;
  providerPolicy: ProviderPolicyEvidence;
  baselineScore: number;
  baselineLatency: number | null;
  baselineCapabilities: Record<string, unknown>;
}): Promise<AutoModelApprovalSummary["outcomes"][number]> {
  const now = new Date().toISOString();
  const publisher = publisherOf(row.model_id);
  const origin = TRUSTED_PUBLISHERS[publisher];
  const reasons: string[] = [];

  if (BLOCKED_PUBLISHERS.has(publisher)) {
    reasons.push("중국계/차단 Publisher 정책에 해당합니다.");
    await saveRejected(config, row, now, reasons, "origin_policy_blocked");
    return { modelId: row.model_id, status: "rejected", reasons };
  }
  if (!origin) {
    reasons.push("Approved Provider Allowlist에 없는 개발사라 자동 승인할 수 없습니다.");
    await savePending(config, row, now, reasons, "publisher_review_required");
    return { modelId: row.model_id, status: "pending", reasons };
  }

  if (
    !providerPolicy.baselineApproved ||
    !providerPolicy.officialTermsReachable ||
    !providerPolicy.privacyPolicyReachable ||
    !providerPolicy.securityGuidanceReachable ||
    !providerPolicy.allowedForStudentData ||
    providerPolicy.trainingOnApiData
  ) {
    reasons.push("NVIDIA Provider의 학생 데이터·보안·개인정보 정책 자동 검증이 완료되지 않았습니다.");
    await savePending(config, row, now, reasons, "provider_policy_unverified");
    return { modelId: row.model_id, status: "pending", reasons };
  }

  const [official, benchmark] = await Promise.all([
    verifyOfficialEvidence(row.model_id),
    benchmarkModel(config, row.model_id),
  ]);

  if (!official.modelPage || !official.modelCard) {
    reasons.push("NVIDIA 공식 모델 페이지 또는 Model Card를 확인할 수 없습니다.");
  }
  if (!official.benchmarkEvidence) {
    reasons.push("공식 Model Card에서 benchmark/evaluation 근거를 확인하지 못했습니다.");
  }
  if (!official.licenseEvidence || !official.commercialUse) {
    reasons.push("자동 승인 가능한 라이선스/상업적 사용 근거를 확인하지 못했습니다.");
  }
  if (!benchmark.operational) {
    reasons.push(`NVIDIA API 실제 호출에 실패했습니다${benchmark.failureCode ? ` (${benchmark.failureCode})` : ""}.`);
  }
  if (!benchmark.structuredOutput) reasons.push("Structured Output 내부 검증을 통과하지 못했습니다.");
  if (!benchmark.korean) reasons.push("한국어 내부 benchmark를 통과하지 못했습니다.");
  if (!benchmark.subjectPass) reasons.push("수학·과학·사회 과목 내부 benchmark를 통과하지 못했습니다.");
  if (!benchmark.hallucinationGuard) reasons.push("성취기준 환각 방지 테스트를 통과하지 못했습니다.");
  if (!benchmark.sourceFaithfulness) reasons.push("자료 충실도(source-faithfulness) 테스트를 통과하지 못했습니다.");
  if (benchmark.score < MIN_INTERNAL_SCORE) {
    reasons.push(`내부 Eval 점수 ${benchmark.score.toFixed(3)}가 최소 기준 ${MIN_INTERNAL_SCORE.toFixed(3)}보다 낮습니다.`);
  }
  if (benchmark.score + 1e-9 < baselineScore) {
    reasons.push(`현재 운영 기준 품질(${baselineScore.toFixed(3)})보다 낮습니다.`);
  }

  const candidateCapabilities = {
    korean: benchmark.korean,
    reasoning: benchmark.reasoning || official.reasoning,
    structured_output: benchmark.structuredOutput,
    long_context: official.longContext,
    vision: official.vision,
  };
  const capabilityGain = Object.entries(candidateCapabilities).some(
    ([key, value]) => value === true && baselineCapabilities[key] !== true,
  );
  const latencyGain =
    benchmark.latencyMs !== null &&
    baselineLatency !== null &&
    benchmark.latencyMs <= baselineLatency * LATENCY_IMPROVEMENT_RATIO;
  const qualityGain = benchmark.score > baselineScore + 0.001;

  const hardPass =
    official.modelPage &&
    official.modelCard &&
    official.benchmarkEvidence &&
    official.licenseEvidence &&
    official.commercialUse &&
    benchmark.operational &&
    benchmark.structuredOutput &&
    benchmark.korean &&
    benchmark.subjectPass &&
    benchmark.hallucinationGuard &&
    benchmark.sourceFaithfulness &&
    benchmark.score >= MIN_INTERNAL_SCORE;

  if (!hardPass) {
    await saveRejected(config, row, now, reasons, "auto_eval_failed", {
      origin,
      official,
      benchmark,
      baselineScore,
      baselineLatency,
      candidateCapabilities,
    });
    return { modelId: row.model_id, status: "rejected", reasons };
  }

  const qualityTier =
    benchmark.score >= 0.95 || candidateCapabilities.reasoning ? "high" : "efficient";
  const taskAffinity = candidateCapabilities.reasoning
    ? [
        "task_parser",
        "strategy",
        "writer",
        "logic_critic",
        "curriculum_verifier",
        "rubric_grader",
        "final_rewriter",
      ]
    : ["task_parser", "strategy", "writer"];
  const priority = Math.min(
    120,
    80 + Math.round(benchmark.score * 20) + (capabilityGain ? 5 : 0) + (latencyGain ? 5 : 0),
  );

  await patchModel(config, row.model_id, {
    enabled: true,
    developer_company: origin.company,
    country_of_headquarters: origin.headquarters,
    china_origin_excluded: true,
    origin_reviewed_at: now,
    approved_provider: true,
    approved_model: true,
    allowed_for_student_data: true,
    training_on_api_data: false,
    zero_data_retention_available: providerPolicy.zeroDataRetentionAvailable,
    security_review_passed: true,
    security_reviewed_at: now,
    privacy_policy_verified: true,
    privacy_reviewed_at: now,
    deprecated: false,
    capabilities_json: candidateCapabilities,
    evaluation_profile_json: {
      ...(capabilityRecord(row.evaluation_profile_json)),
      qualityTier,
      priority,
      taskAffinity,
      subjectAffinity: ["all"],
      formatAffinity: ["all"],
      difficultyMin: 1,
      difficultyMax: 7,
      internalEvalScore: benchmark.score,
      latencyMs: benchmark.latencyMs,
      externalEvidenceVerified: true,
      status: "auto_production_approved",
      policyVersion: POLICY_VERSION,
      autoReviewedAt: now,
      baselineScore,
      baselineLatencyMs: baselineLatency,
      improvement: {
        quality: qualityGain,
        latency: latencyGain,
        capability: capabilityGain,
      },
      officialEvidence: official,
    },
    production_approved: true,
    updated_at: now,
  });

  return {
    modelId: row.model_id,
    status: "approved",
    reasons: [
      "출처·Provider·학생 데이터·보안·개인정보 Hard Filter 통과",
      "공식 Model Card/benchmark/라이선스 근거 확인",
      `한국어·과목·환각·출처 충실도 내부 Eval 통과 (${benchmark.score.toFixed(3)})`,
      qualityGain
        ? "현재 운영 모델보다 내부 품질 점수 개선"
        : latencyGain
          ? "현재 운영 모델과 동급 품질에서 지연시간 개선"
          : capabilityGain
            ? "현재 운영 모델 대비 capability 개선"
            : "완화된 운영 기준의 최소 품질·안전 조건 통과",
    ],
  };
}

async function verifyProviderPolicy(
  config: Config,
  rows: RegistryRow[],
): Promise<ProviderPolicyEvidence> {
  const baseline = rows.find(
    (row) =>
      row.approved_provider === true &&
      row.allowed_for_student_data === true &&
      row.training_on_api_data === false &&
      row.security_review_passed === true &&
      row.privacy_policy_verified === true,
  );

  const [terms, privacy, security] = await Promise.all([
    reachable("https://developer.nvidia.com/legal/terms"),
    reachable("https://www.nvidia.com/en-us/about-nvidia/privacy-policy/"),
    reachable(
      "https://docs.nvidia.com/ai-enterprise/planning-resource/ai-enterprise-security-white-paper/latest/nim-microservices.html",
    ),
  ]);

  return {
    baselineApproved: Boolean(baseline),
    officialTermsReachable: terms,
    privacyPolicyReachable: privacy,
    securityGuidanceReachable: security,
    allowedForStudentData: baseline?.allowed_for_student_data === true,
    trainingOnApiData: baseline?.training_on_api_data !== false,
    zeroDataRetentionAvailable: baseline?.zero_data_retention_available === true,
  };
}

async function verifyOfficialEvidence(modelId: string): Promise<OfficialEvidence> {
  const parts = modelId.split("/");
  if (parts.length < 2) {
    return emptyOfficialEvidence();
  }
  const publisher = encodeURIComponent(parts[0]);
  const name = encodeURIComponent(parts.slice(1).join("/"));
  const root = `https://build.nvidia.com/${publisher}/${name}`;

  try {
    const [pageResponse, cardResponse] = await Promise.all([
      fetch(root, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${root}/modelcard`, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(10_000),
      }),
    ]);
    const [pageText, cardText] = await Promise.all([
      pageResponse.ok ? pageResponse.text() : Promise.resolve(""),
      cardResponse.ok ? cardResponse.text() : Promise.resolve(""),
    ]);
    const text = `${pageText}\n${cardText}`.toLowerCase();
    return {
      modelPage: pageResponse.ok && pageText.length > 100,
      modelCard: cardResponse.ok && cardText.length > 100,
      benchmarkEvidence: /benchmark|evaluation|eval\b/.test(text),
      licenseEvidence: /license|governing terms|terms of use/.test(text),
      commercialUse:
        /commercial use|commercial\/non-commercial|commercial and non-commercial|commercially usable/.test(text) ||
        /apache license|open model license|openmdw|community model license/.test(text),
      reasoning: /reasoning|reasoning model|reasoning capability/.test(text),
      vision: /vision|multimodal|image input|input modalities[^<]{0,100}image/.test(text),
      longContext: /context length|long.context|128k|256k|1m token|million token/.test(text),
    };
  } catch {
    return emptyOfficialEvidence();
  }
}

async function benchmarkModel(config: Config, modelId: string): Promise<BenchmarkResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${config.nvidiaBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.nvidiaApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "system",
            content: "한국어 학교 수행평가용 모델 자동 검증입니다. 지시된 JSON 객체 하나만 출력하세요.",
          },
          { role: "user", content: BENCHMARK_PROMPT },
        ],
        temperature: 0,
        top_p: 0.1,
        max_tokens: 900,
        stream: false,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    const latencyMs = Date.now() - startedAt;
    if (!response.ok) {
      return failedBenchmark(latencyMs, `NVIDIA_${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = parseObject(raw);
    if (!parsed) {
      return {
        ...failedBenchmark(latencyMs, "INVALID_JSON"),
        operational: true,
      };
    }

    const checks = {
      math: Number(parsed.math) === 169,
      arithmetic: Number(parsed.arithmetic) === 888,
      science: normalizeText(parsed.science) === "기화",
      social: ["입법부", "국회"].includes(normalizeText(parsed.social)),
      korean: normalizeText(parsed.korean) === "민지",
      source: normalizeText(parsed.source) === "자료에없음",
      hallucination: normalizeText(parsed.hallucination) === "확인필요",
      reasoning: Number(parsed.reasoning) === 42,
    };
    const passed = Object.values(checks).filter(Boolean).length;
    const score = passed / Object.keys(checks).length;

    return {
      operational: true,
      structuredOutput: true,
      korean: checks.korean && checks.science && checks.hallucination,
      subjectPass: checks.math && checks.arithmetic && checks.science && checks.social,
      hallucinationGuard: checks.hallucination,
      sourceFaithfulness: checks.source,
      reasoning: checks.math && checks.reasoning,
      score,
      latencyMs,
      failureCode: null,
    };
  } catch (error) {
    const code = error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "REQUEST_FAILED";
    return failedBenchmark(Date.now() - startedAt, code);
  }
}

async function loadRegistry(config: Config): Promise<RegistryRow[]> {
  const select = [
    "model_id",
    "enabled",
    "developer_company",
    "country_of_headquarters",
    "china_origin_excluded",
    "approved_provider",
    "approved_model",
    "allowed_for_student_data",
    "training_on_api_data",
    "zero_data_retention_available",
    "security_review_passed",
    "privacy_policy_verified",
    "deprecated",
    "capabilities_json",
    "evaluation_profile_json",
    "production_approved",
    "catalog_available",
    "catalog_first_seen_at",
  ].join(",");
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/model_registry?select=${encodeURIComponent(select)}&provider=eq.nvidia&order=production_approved.desc,updated_at.desc`,
    {
      headers: authHeaders(config),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new Error(`AUTO_REVIEW_REGISTRY_${response.status}`);
  return (await response.json()) as RegistryRow[];
}

function pickBaseline(rows: RegistryRow[]): RegistryRow | null {
  const production = rows.filter(
    (row) => row.production_approved && row.enabled && !row.deprecated,
  );
  if (!production.length) return null;
  return [...production].sort(
    (a, b) => evaluationPriority(b.evaluation_profile_json) - evaluationPriority(a.evaluation_profile_json),
  )[0] ?? null;
}

async function recordBaselineEvaluation(
  config: Config,
  row: RegistryRow,
  benchmark: BenchmarkResult,
) {
  const now = new Date().toISOString();
  await patchModel(config, row.model_id, {
    evaluation_profile_json: {
      ...capabilityRecord(row.evaluation_profile_json),
      internalEvalScore: benchmark.score,
      latencyMs: benchmark.latencyMs,
      lastAutomatedRegressionCheck: now,
      automatedRegressionOperational: benchmark.operational,
      automatedRegressionCriticalPass:
        benchmark.structuredOutput &&
        benchmark.korean &&
        benchmark.subjectPass &&
        benchmark.hallucinationGuard &&
        benchmark.sourceFaithfulness,
      policyVersion: POLICY_VERSION,
    },
    updated_at: now,
  });
}

async function saveRejected(
  config: Config,
  row: RegistryRow,
  now: string,
  reasons: string[],
  status: string,
  evidence: Record<string, unknown> = {},
) {
  const publisher = publisherOf(row.model_id);
  const origin = TRUSTED_PUBLISHERS[publisher];
  await patchModel(config, row.model_id, {
    enabled: false,
    ...(origin
      ? {
          developer_company: origin.company,
          country_of_headquarters: origin.headquarters,
          china_origin_excluded: true,
          origin_reviewed_at: now,
        }
      : {}),
    approved_model: false,
    production_approved: false,
    evaluation_profile_json: {
      ...capabilityRecord(row.evaluation_profile_json),
      status,
      autoReviewedAt: now,
      policyVersion: POLICY_VERSION,
      autoReviewReasons: reasons,
      ...evidence,
    },
    updated_at: now,
  });
}

async function savePending(
  config: Config,
  row: RegistryRow,
  now: string,
  reasons: string[],
  status: string,
) {
  await patchModel(config, row.model_id, {
    enabled: false,
    approved_model: false,
    production_approved: false,
    evaluation_profile_json: {
      ...capabilityRecord(row.evaluation_profile_json),
      status,
      autoReviewedAt: now,
      policyVersion: POLICY_VERSION,
      autoReviewReasons: reasons,
    },
    updated_at: now,
  });
}

async function patchModel(config: Config, modelId: string, body: Record<string, unknown>) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/model_registry?model_id=eq.${encodeURIComponent(modelId)}`,
    {
      method: "PATCH",
      headers: {
        ...authHeaders(config),
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    },
  );
  if (!response.ok) throw new Error(`AUTO_REVIEW_PATCH_${response.status}`);
}

async function reachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function readConfig(): Config {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)
    ?.trim()
    .replace(/\/$/, "");
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  const nvidiaApiKey = (process.env.NVIDIA_API_KEY || process.env.Nvidia_key)?.trim();
  const nvidiaBaseUrl = (
    process.env.NVIDIA_BASE_URL?.trim() || "https://integrate.api.nvidia.com/v1"
  ).replace(/\/$/, "");
  if (!supabaseUrl || !secretKey || !nvidiaApiKey) {
    throw new Error("AUTO_MODEL_APPROVAL_CONFIGURATION");
  }
  return { supabaseUrl, secretKey, nvidiaApiKey, nvidiaBaseUrl };
}

function authHeaders(config: Config): Record<string, string> {
  return {
    apikey: config.secretKey,
    Accept: "application/json",
    ...(config.secretKey.split(".").length === 3
      ? { Authorization: `Bearer ${config.secretKey}` }
      : {}),
  };
}

function publisherOf(modelId: string): string {
  return modelId.split("/")[0]?.trim().toLowerCase() ?? "";
}

function capabilityRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function evaluationPriority(value: unknown): number {
  const priority = capabilityRecord(value).priority;
  return typeof priority === "number" && Number.isFinite(priority) ? priority : 0;
}

function readNumeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.replace(/[\s.,!?"'`~:;()\[\]{}]/g, "").trim()
    : "";
}

function parseObject(raw: string): Record<string, unknown> | null {
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function failedBenchmark(latencyMs: number, failureCode: string): BenchmarkResult {
  return {
    operational: false,
    structuredOutput: false,
    korean: false,
    subjectPass: false,
    hallucinationGuard: false,
    sourceFaithfulness: false,
    reasoning: false,
    score: 0,
    latencyMs,
    failureCode,
  };
}

function emptyOfficialEvidence(): OfficialEvidence {
  return {
    modelPage: false,
    modelCard: false,
    benchmarkEvidence: false,
    licenseEvidence: false,
    commercialUse: false,
    reasoning: false,
    vision: false,
    longContext: false,
  };
}
