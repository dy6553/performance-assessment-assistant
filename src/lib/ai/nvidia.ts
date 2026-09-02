import "server-only";

import { z } from "zod";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";

type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

type ChatMessage = { role: "system" | "user" | "assistant"; content: ChatContent };

type NvidiaResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type CompletionResult = {
  raw: string;
  promptTokens: number | null;
  completionTokens: number | null;
};

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issueSummary: string };

export type StructuredRun<T> = {
  data: T;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
};

export async function generateStructured<T>({
  taskName,
  model,
  schema,
  messages,
  maxTokens = 8_192,
  temperature = 0.15,
  signal,
  fallbackModel,
}: {
  taskName: string;
  model: string;
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  fallbackModel?: string | null;
}): Promise<StructuredRun<T>> {
  const candidates = [model, ...(fallbackModel && fallbackModel !== model ? [fallbackModel] : [])];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await runStructured({
        taskName,
        model: candidate,
        schema,
        messages,
        maxTokens,
        temperature,
        signal,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${taskName} AI 호출에 실패했습니다.`);
}

async function runStructured<T>({
  taskName,
  model,
  schema,
  messages,
  maxTokens,
  temperature,
  signal,
}: {
  taskName: string;
  model: string;
  schema: z.ZodType<T>;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}): Promise<StructuredRun<T>> {
  const apiKey = (process.env.NVIDIA_API_KEY || process.env.Nvidia_key)?.trim();
  if (!apiKey) throw new Error("NVIDIA_API_KEY가 설정되지 않았습니다.");

  const baseUrl = (process.env.NVIDIA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
  const first = await requestCompletion({
    taskName,
    model,
    messages,
    maxTokens,
    temperature,
    signal,
    apiKey,
    baseUrl,
  });

  const firstValidation = validateStructured(first.raw, schema);
  if (firstValidation.success) {
    return {
      data: firstValidation.data,
      model,
      promptTokens: first.promptTokens,
      completionTokens: first.completionTokens,
    };
  }

  const repair = await requestCompletion({
    taskName: `${taskName}_repair`,
    model,
    messages: [
      ...messages,
      { role: "assistant", content: first.raw },
      {
        role: "user",
        content: [
          "방금 응답은 JSON 출력 계약 검증에 실패했습니다.",
          "원래 요청과 답의 의미를 유지하되 검증 오류만 수정해서 유효한 JSON 객체 하나를 다시 출력하세요.",
          "설명, 마크다운 코드블록, 주석, JSON 바깥의 문장을 절대 넣지 마세요.",
          "필수 배열 개수, 필수 필드, 문자열 길이, 허용된 값, 추가 필드 금지 조건을 모두 지키세요.",
          `검증 오류:\n${firstValidation.issueSummary}`,
        ].join("\n"),
      },
    ],
    maxTokens,
    temperature: 0,
    signal,
    apiKey,
    baseUrl,
  });

  const repairedValidation = validateStructured(repair.raw, schema);
  if (!repairedValidation.success) {
    throw new Error(`${taskName} AI 응답이 출력 계약을 충족하지 못했습니다.`);
  }

  return {
    data: repairedValidation.data,
    model,
    promptTokens: addTokenCounts(first.promptTokens, repair.promptTokens),
    completionTokens: addTokenCounts(first.completionTokens, repair.completionTokens),
  };
}

async function requestCompletion({
  taskName,
  model,
  messages,
  maxTokens,
  temperature,
  signal,
  apiKey,
  baseUrl,
}: {
  taskName: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
  apiKey: string;
  baseUrl: string;
}): Promise<CompletionResult> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: temperature === 0 ? 0.1 : 0.85,
      max_tokens: maxTokens,
      stream: false,
    }),
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const safeCode = `NVIDIA_${response.status}`;
    console.warn("NVIDIA AI 호출 실패", {
      taskName,
      model,
      status: response.status,
      errorCode: safeCode,
    });
    throw new Error(`${taskName} AI 호출에 실패했습니다. (${safeCode})`);
  }

  const payload = (await response.json()) as NvidiaResponse;
  const raw = payload.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error(`${taskName} AI 응답이 비어 있습니다.`);

  return {
    raw,
    promptTokens: payload.usage?.prompt_tokens ?? null,
    completionTokens: payload.usage?.completion_tokens ?? null,
  };
}

function validateStructured<T>(raw: string, schema: z.ZodType<T>): ValidationResult<T> {
  const json = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      success: false,
      issueSummary: "응답에서 완전한 JSON 객체를 해석할 수 없습니다.",
    };
  }

  const checked = schema.safeParse(parsed);
  if (checked.success) return { success: true, data: checked.data };

  return {
    success: false,
    issueSummary: checked.error.issues
      .slice(0, 16)
      .map((issue) => `${issue.path.length ? issue.path.join(".") : "$"}: ${issue.message}`)
      .join("\n"),
  };
}

function addTokenCounts(first: number | null, second: number | null): number | null {
  if (first === null && second === null) return null;
  return (first ?? 0) + (second ?? 0);
}

function extractJsonObject(input: string): string {
  const withoutFence = input.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = withoutFence.indexOf("{");
  if (start < 0) return withoutFence;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < withoutFence.length; i += 1) {
    const char = withoutFence[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return withoutFence.slice(start, i + 1);
    }
  }

  return withoutFence.slice(start);
}
