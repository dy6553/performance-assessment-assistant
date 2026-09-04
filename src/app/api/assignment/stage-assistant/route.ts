import { z } from "zod";

import {
  analysisResultSchema,
  assignmentInputSchema,
  draftResultSchema,
  verificationResultSchema,
  type AssignmentInput,
} from "@/features/assessment/schemas";
import { executionPlanResultSchema, researchResultSchema } from "@/features/assessment/stage-schemas";
import { careerContextForPrompt, getCareerAiContext } from "@/features/assessment/server/career-context";
import { composePostTopicPrompt, composeVerificationPrompt } from "@/features/assessment/server/post-topic-prompts";
import {
  executionPlanStagePromptForAssistant,
  researchStagePromptForAssistant,
} from "@/features/assessment/server/stage-service";
import { composeTopicSelectionPrompts } from "@/features/assessment/server/topic-selection-prompts";
import { composeAssessmentPrompts, getAssessmentTypePrompt, type AssessmentPromptType } from "@/features/assessment/server/type-prompts";
import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel } from "@/lib/ai/router";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const jsonValueSchema = z.json();
const editableTargetSchema = z.enum(["assignment", "analysis", "research", "plan", "draft", "none"]);
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
    research: researchResultSchema.nullable(),
    plan: executionPlanResultSchema.nullable(),
    draft: draftResultSchema.nullable(),
    verification: verificationResultSchema.extend({ readinessScore: z.number().min(0).max(100).optional() }).nullable(),
    target: editableTargetSchema,
  })
  .strict();

const resultSchema = z
  .object({
    reply: z.string().trim().min(1).max(8_000),
    target: editableTargetSchema,
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
    const specialistPrompt = buildSpecialistPrompt(input);
    const route = await routeModel({
      task: input.target === "draft" ? "final_rewriter" : "strategy",
      inputCharacters: JSON.stringify({ input, careerContext }).length + specialistPrompt.length,
      context: input.assignment ? {
        subject: input.assignment.subject,
        schoolLevel: input.assignment.schoolLevel,
        grade: input.assignment.grade,
        assignmentType: resolvePromptType(input.assignment),
        format: input.assignment.formatRule || input.assignment.course,
      } : undefined,
    });

    const outputContract = {
      reply: "학생에게 보여 줄 한국어 답변",
      target: "assignment | analysis | research | plan | draft | none",
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
      taskName: "assignment_stage_context_assistant",
      model: route.model,
      fallbackModel: route.fallback,
      schema: resultSchema,
      maxTokens: 10_000,
      temperature: 0.16,
      messages: [
        {
          role: "system",
          content: [
            "당신은 한국 초·중·고 학생의 수행평가 전 과정을 돕는 AI 도우미다.",
            "현재 단계의 전문 프롬프트를 반드시 최우선 작업 규칙으로 사용한다.",
            "교사 안내문·루브릭·성취기준을 일반적인 조언보다 우선한다.",
            "학생이 실제로 하지 않은 조사·실험·측정·인터뷰·결과를 만들어내지 않는다.",
            "자료검증 단계에서 서버가 확인하지 않은 출처를 확인 완료라고 표현하지 않는다.",
            "현재 단계 이전에 확정된 주제·자료검증·수행설계 결과를 임의로 무시하거나 뒤집지 않는다.",
            "careerContext는 자연스럽게 필요한 경우에만 참고하고 진로를 억지로 연결하지 않는다.",
            "상담만 하는 경우 target은 none으로 한다. 수정 요청이면 입력받은 현재 target을 유지한다.",
            "수정을 제안할 때 changes에는 JSON Pointer별 변경을 넣고 proposedValue에는 모든 변경이 적용된 전체 객체를 넣는다.",
            "반드시 JSON 객체 하나만 출력한다.",
            "",
            "[현재 단계 전문 프롬프트]",
            specialistPrompt,
            "",
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
            researchEvidence: input.research,
            executionPlan: input.plan,
            currentDraft: input.draft,
            verification: input.verification,
            recentChat: input.messages,
            request: input.userMessage,
          }),
        },
      ],
    });

    return Response.json(
      { data: validateProposal(run.data, input.target), route: { ...route, model: run.model } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json({ error: publicApiError(error, "AI 도우미 답변을 만들지 못했습니다.") }, { status: 502 });
  }
}

function buildSpecialistPrompt(input: z.infer<typeof requestSchema>) {
  const assignment = input.assignment;
  if (!assignment) return "수행평가 정보가 아직 없으므로 일반적인 준비 상담만 하고 결과물을 임의로 생성하지 마세요.";
  const type = resolvePromptType(assignment);

  if (input.pathname.includes("/topic")) {
    return composeTopicSelectionPrompts({
      curriculum: assignment.curriculum,
      schoolLevel: assignment.schoolLevel,
      grade: assignment.grade,
      subject: assignment.subject,
      course: assignment.course,
      assignmentType: assignment.assignmentType,
      careerLinked: assignment.careerLinked,
      teacherInstruction: assignment.teacherInstruction,
      rubricText: assignment.rubricText,
      achievementStandardText: assignment.achievementStandardText,
      requiredElements: assignment.requiredElements,
      lengthRule: assignment.lengthRule,
      formatRule: assignment.formatRule,
      studentIdeas: assignment.studentIdeas,
      interestField: "",
      desiredMajor: "",
      desiredCareer: "",
      additionalConditions: "",
      avoidTopics: [],
    }).combinedPrompt;
  }

  if (input.pathname.includes("/workspace")) {
    if (!input.research) return researchStagePromptForAssistant();
    if (!input.plan) return executionPlanStagePromptForAssistant();
    if (input.verification) return composeVerificationPrompt(type);
    return composePostTopicPrompt(type);
  }
  if (input.pathname.includes("/verification")) return composeVerificationPrompt(type);
  if (input.pathname.includes("/draft") || input.pathname.includes("/presentation") || input.pathname.includes("/inquiry")) return composePostTopicPrompt(type);
  return composeAssessmentPrompts(type);
}

function resolvePromptType(assignment: AssignmentInput): AssessmentPromptType {
  const aliases: Record<string, AssessmentPromptType> = {
    "발표·토론": "실제발표",
    "발표": "실제발표",
    "실제 발표": "실제발표",
    "PPT": "비발표자료",
    "발표자료": "비발표자료",
    "비발표 자료": "비발표자료",
    "실험·탐구": "실험탐구",
    "실험": "실험탐구",
    "실생활 적용 탐구": "실생활적용탐구",
  };
  const parts = assignment.assignmentType.split(/\s*\+\s*|\s*\/\s*/).map((value) => value.trim()).filter(Boolean);
  for (const part of parts) {
    const normalized = aliases[part] ?? part;
    if (getAssessmentTypePrompt(normalized)) return normalized as AssessmentPromptType;
  }
  return "탐구보고서";
}

function validateProposal(
  result: z.infer<typeof resultSchema>,
  requestedTarget: z.infer<typeof editableTargetSchema>,
) {
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
      : result.target === "research"
        ? researchResultSchema
        : result.target === "plan"
          ? executionPlanResultSchema
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
