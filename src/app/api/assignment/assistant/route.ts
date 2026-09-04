import { z } from "zod";

import {
  analysisResultSchema,
  assignmentInputSchema,
  draftResultSchema,
  verificationResultSchema,
} from "@/features/assessment/schemas";
import { careerContextForPrompt, getCareerAiContext } from "@/features/assessment/server/career-context";
import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel } from "@/lib/ai/router";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const jsonValueSchema = z.json();
const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(8_000),
});

const requestSchema = z
  .object({
    pathname: z.string().trim().max(300),
    stage: z.string().trim().min(1).max(100),
    userMessage: z.string().trim().min(1).max(6_000),
    messages: z.array(chatMessageSchema).max(12).default([]),
    assignment: assignmentInputSchema.nullable(),
    analysis: analysisResultSchema.nullable(),
    draft: draftResultSchema.nullable(),
    verification: verificationResultSchema.extend({ readinessScore: z.number().min(0).max(100).optional() }).nullable(),
    target: z.enum(["assignment", "analysis", "draft", "none"]),
  })
  .strict();

const resultSchema = z
  .object({
    reply: z.string().trim().min(1).max(8_000),
    target: z.enum(["assignment", "analysis", "draft", "none"]),
    changes: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(60),
            path: z.string().trim().min(1).max(300),
            title: z.string().trim().min(1).max(160),
            description: z.string().trim().min(1).max(800),
            value: jsonValueSchema,
          })
          .strict(),
      )
      .max(20),
    proposedValue: jsonValueSchema.nullable(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "AI 도우미 요청 내용을 다시 확인해 주세요." }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const career = await getCareerAiContext(input.assignment?.careerLinked);
    const careerContext = careerContextForPrompt(career);
    const route = await routeModel({
      task: input.target === "draft" ? "final_rewriter" : "strategy",
      inputCharacters: JSON.stringify({ input, careerContext }).length,
    });

    const outputContract = {
      reply: "학생에게 보여 줄 한국어 답변",
      target: "assignment | analysis | draft | none",
      changes: [
        {
          id: "change-1",
          path: "/sections/0/body",
          title: "변경 제목",
          description: "무엇이 왜 바뀌는지",
          value: "해당 경로에 넣을 실제 JSON 값",
        },
      ],
      proposedValue: "변경을 모두 적용한 target 전체 JSON 또는 null",
    };

    const run = await generateStructured({
      taskName: "assignment_context_assistant",
      model: route.model,
      fallbackModel: route.fallback,
      schema: resultSchema,
      maxTokens: 10_000,
      temperature: 0.18,
      messages: [
        {
          role: "system",
          content: [
            "당신은 한국 초·중·고 학생의 수행평가 전 과정을 돕는 AI 도우미다.",
            "현재 단계, 교사 안내문, 이전 분석·초안·검증 결과를 먼저 파악한 뒤 질문에 답한다.",
            "학생의 생각과 최종 결정권을 존중하며, 요청하지 않은 내용을 임의로 적용하지 않는다.",
            "사실·통계·법·정책·연구처럼 외부 확인이 필요한 내용은 확정적으로 꾸며내지 말고 확인 필요성을 밝힌다.",
            "교사 안내와 루브릭을 가장 높은 우선순위로 유지한다.",
            "careerContext가 제공되면 교과와 수행평가 목적에 자연스럽게 맞는 경우에만 참고하고, 억지로 진로와 연결하지 않는다.",
            "수정 요청이면 target은 입력으로 받은 target과 같아야 하고, 변경이 없는 상담이면 target은 none으로 한다.",
            "수정을 제안할 때 changes에는 JSON Pointer 경로별 독립 변경을 넣고 proposedValue에는 모든 변경이 적용된 전체 객체를 넣는다.",
            "각 changes.value는 요약문이 아니라 실제로 적용할 JSON 값이어야 한다.",
            "배열 전체를 고치면 배열 요소별 경로 대신 해당 배열의 경로와 전체 배열 값을 사용한다.",
            "반드시 JSON 객체 하나만 출력한다.",
            `출력 계약: ${JSON.stringify(outputContract)}`,
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            currentStage: input.stage,
            currentPath: input.pathname,
            editableTarget: input.target,
            careerContext,
            assignment: input.assignment,
            previousAnalysis: input.analysis,
            currentDraft: input.draft,
            verification: input.verification,
            recentChat: input.messages,
            request: input.userMessage,
          }),
        },
      ],
    });

    const checked = validateProposal(run.data, input.target);
    return Response.json(
      { data: checked, route: { ...route, model: run.model } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: publicApiError(error, "AI 도우미 답변을 만들지 못했습니다.") },
      { status: 502 },
    );
  }
}

function validateProposal(result: z.infer<typeof resultSchema>, requestedTarget: z.infer<typeof requestSchema>["target"]) {
  if (result.target === "none" || !result.proposedValue || requestedTarget === "none") {
    return { ...result, target: "none" as const, changes: [], proposedValue: null };
  }

  if (result.target !== requestedTarget) {
    return { ...result, target: "none" as const, changes: [], proposedValue: null };
  }

  const schema = result.target === "assignment"
    ? assignmentInputSchema
    : result.target === "analysis"
      ? analysisResultSchema
      : draftResultSchema;
  const validated = schema.safeParse(result.proposedValue);
  if (!validated.success) {
    return {
      ...result,
      reply: `${result.reply}\n\n수정안의 형식을 안전하게 확인하지 못해 자동 반영 버튼은 표시하지 않았습니다. 의견을 참고해 직접 수정해 주세요.`,
      target: "none" as const,
      changes: [],
      proposedValue: null,
    };
  }

  return { ...result, proposedValue: validated.data };
}
