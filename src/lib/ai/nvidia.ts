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
      top_p: 0.85,
      max_tokens: maxTokens,
      stream: false,
    }),
    cache: "no-store",
    signal: signal ?? AbortSignal.timeout(180_000),
  });

  if (!response.ok) {
    const safeCode = `NVIDIA_${response.status}`;
    throw new Error(`${taskName} AI 호출에 실패했습니다. (${safeCode})`);
  }

  const payload = (await response.json()) as NvidiaResponse;
  const raw = payload.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error(`${taskName} AI 응답이 비어 있습니다.`);

  const json = extractJsonObject(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`${taskName} AI 응답을 JSON으로 해석하지 못했습니다.`);
  }

  const checked = schema.safeParse(parsed);
  if (!checked.success) {
    throw new Error(`${taskName} AI 응답이 출력 계약을 충족하지 못했습니다.`);
  }

  return {
    data: checked.data,
    model,
    promptTokens: payload.usage?.prompt_tokens ?? null,
    completionTokens: payload.usage?.completion_tokens ?? null,
  };
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
