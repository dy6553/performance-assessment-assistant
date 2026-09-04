import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  draftResultSchema,
  type AnalysisResult,
  type AssignmentInput,
  type DraftResult,
} from "../schemas";
import {
  executionPlanResultSchema,
  researchResultSchema,
  type ExecutionPlanResult,
  type ResearchResult,
} from "../stage-schemas";
import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel, type ModelRoute } from "@/lib/ai/router";
import { composePostTopicPrompt } from "./post-topic-prompts";
import { collectResearchEvidence } from "./source-research";
import { getAssessmentTypePrompt, type AssessmentPromptType } from "./type-prompts";

type RunResult<T> = { data: T; route: ModelRoute };

const promptDir = join(process.cwd(), "src/features/assessment/server/stage-prompts");
const researchPrompt = readFileSync(join(promptDir, "research-evidence.txt"), "utf-8").trim();
const executionPlanPrompt = readFileSync(join(promptDir, "execution-plan.txt"), "utf-8").trim();

export async function researchAssignmentEvidence(
  assignment: AssignmentInput,
  analysis: AnalysisResult,
  sourceNotes: string,
): Promise<RunResult<ResearchResult>> {
  const liveEvidence = await collectResearchEvidence({
    sourceNotes,
    topic: assignment.topic,
    subject: assignment.subject,
  });
  const route = await routeModel({
    task: "strategy",
    inputCharacters: JSON.stringify({ assignment, analysis, sourceNotes, liveEvidence }).length + researchPrompt.length,
    context: {
      subject: assignment.subject,
      schoolLevel: assignment.schoolLevel,
      grade: assignment.grade,
      assignmentType: resolvePromptType(assignment),
      format: assignment.formatRule || assignment.course,
    },
  });

  const outputContract = {
    summary: "현재 근거 준비 상태 요약",
    liveSourceChecks: liveEvidence.liveSourceChecks,
    academicCandidates: liveEvidence.academicCandidates,
    evidenceNeeds: [
      {
        claimOrQuestion: "반드시 근거가 필요한 주장 또는 질문",
        preferredSourceTypes: ["정부·공공기관", "학술논문"],
        searchQueries: ["실제로 검색할 구체적 검색어"],
        status: "VERIFIED_ENOUGH | PARTIAL | NEEDS_WEB_VERIFICATION",
        notes: "현재 확보 상태와 추가 확인 사항",
      },
    ],
    gaps: ["초안 전에 메워야 할 근거 공백"],
    nextActions: ["학생이 다음으로 해야 할 일"],
  };

  const run = await generateStructured({
    taskName: "assignment_research_evidence",
    model: route.model,
    fallbackModel: route.fallback,
    schema: researchResultSchema,
    maxTokens: 7_500,
    temperature: 0.08,
    messages: [
      {
        role: "system",
        content: [
          researchPrompt,
          "",
          `[확정된 수행평가 유형: ${resolvePromptType(assignment)}]`,
          "liveSourceChecks와 academicCandidates는 서버가 실제 네트워크 요청으로 얻은 값입니다. 이 배열의 항목을 삭제·추가·변조하지 말고 그대로 반환하세요.",
          "Crossref 항목은 메타데이터 존재만 확인된 것이므로 원문 내용까지 검증됐다고 표현하지 마세요.",
          "JSON 객체 하나만 출력하세요.",
          `출력 계약: ${JSON.stringify(outputContract)}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          assignment: commonContext(assignment),
          topic: assignment.topic,
          analysis,
          studentProvidedSourceNotes: sourceNotes,
          liveEvidence,
        }),
      },
    ],
  });

  return { data: run.data, route: routeForRun(route, run.model) };
}

export async function buildAssignmentExecutionPlan(
  assignment: AssignmentInput,
  analysis: AnalysisResult,
  research: ResearchResult,
): Promise<RunResult<ExecutionPlanResult>> {
  const route = await routeModel({
    task: "strategy",
    inputCharacters: JSON.stringify({ assignment, analysis, research }).length + executionPlanPrompt.length,
    context: {
      subject: assignment.subject,
      schoolLevel: assignment.schoolLevel,
      grade: assignment.grade,
      assignmentType: resolvePromptType(assignment),
      format: assignment.formatRule || assignment.course,
    },
  });

  const contract = {
    goal: "최종 결과물이 달성해야 할 목표",
    coreQuestion: "결과물이 직접 답해야 할 핵심 질문",
    methodSteps: ["실제 수행 순서"],
    outline: [
      {
        section: "결과물 섹션/슬라이드/실험 단계",
        purpose: "이 부분의 역할",
        evidenceToUse: ["사용할 검증된 근거 또는 추가 확인이 필요한 근거"],
        studentAction: "학생이 실제로 해야 할 행동",
      },
    ],
    rubricMap: [{ criterion: "평가기준", proofInOutput: "결과물에서 보여 줄 구체적 증거" }],
    requiredStudentInputs: ["초안 전에 학생이 직접 채워야 할 실제 정보"],
    checkpoints: ["중간 점검 항목"],
  };

  const run = await generateStructured({
    taskName: "assignment_execution_plan",
    model: route.model,
    fallbackModel: route.fallback,
    schema: executionPlanResultSchema,
    maxTokens: 8_000,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content: [
          executionPlanPrompt,
          "",
          `[확정된 수행평가 유형: ${resolvePromptType(assignment)}]`,
          "자료검증 단계에서 NEEDS_WEB_VERIFICATION인 근거는 계획에 필요 조건으로 남기되 검증 완료된 사실처럼 사용하지 마세요.",
          "JSON 객체 하나만 출력하세요.",
          `출력 계약: ${JSON.stringify(contract)}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({ assignment: commonContext(assignment), topic: assignment.topic, analysis, research }),
      },
    ],
  });

  return { data: run.data, route: routeForRun(route, run.model) };
}

export async function generateDraftFromExecutionPlan(
  assignment: AssignmentInput,
  analysis: AnalysisResult,
  research: ResearchResult,
  plan: ExecutionPlanResult,
): Promise<RunResult<DraftResult>> {
  const promptType = resolvePromptType(assignment);
  const route = await routeModel({
    task: "writer",
    inputCharacters: JSON.stringify({ assignment, analysis, research, plan }).length,
    context: {
      subject: assignment.subject,
      schoolLevel: assignment.schoolLevel,
      grade: assignment.grade,
      assignmentType: promptType,
      format: assignment.formatRule || analysis.requirements.format || assignment.course,
    },
  });
  const contract = {
    title: "제목",
    thesisOrGoal: "핵심 주장 또는 목표",
    sections: [{ heading: "소제목", body: "본문" }],
    claimCandidates: [],
    sourceNeeds: [],
    uncertainties: [],
  };

  const run = await generateStructured({
    taskName: "assignment_writer_from_plan",
    model: route.model,
    fallbackModel: route.fallback,
    schema: draftResultSchema,
    maxTokens: 12_000,
    messages: [
      {
        role: "system",
        content: [
          composePostTopicPrompt(promptType),
          "",
          "[자료검증·수행설계 결과 강제 적용]",
          "research와 plan은 초안보다 앞 단계에서 확정된 결과입니다. outline 순서와 rubricMap을 실제 초안에 반영하세요.",
          "research에서 VERIFIED_ENOUGH가 아닌 근거는 사실로 단정하지 말고 sourceNeeds 또는 uncertainties에 남기세요.",
          "requiredStudentInputs에 실제 학생 데이터가 필요하다고 적힌 부분은 내용을 만들어 채우지 말고 [학생 입력 필요]로 표시하세요.",
          "확정된 주제를 변경하거나 새 주제를 추천하지 마세요.",
          "JSON 객체 하나만 출력하세요.",
          `출력 계약: ${JSON.stringify(contract)}`,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({ assignment: commonContext(assignment), topic: assignment.topic, analysis, research, executionPlan: plan }),
      },
    ],
  });

  return { data: run.data, route: routeForRun(route, run.model) };
}

export function researchStagePromptForAssistant() {
  return researchPrompt;
}

export function executionPlanStagePromptForAssistant() {
  return executionPlanPrompt;
}

function resolvePromptType(assignment: AssignmentInput): AssessmentPromptType {
  const parts = assignment.assignmentType.split(/\s*\+\s*|\s*\/\s*/).map((value) => value.trim()).filter(Boolean);
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
  for (const part of parts) {
    const normalized = aliases[part] ?? part;
    if (getAssessmentTypePrompt(normalized)) return normalized as AssessmentPromptType;
  }
  const primary = analysisLikeType(assignment.formatRule || assignment.teacherInstruction || assignment.requiredElements);
  return primary ?? "탐구보고서";
}

function analysisLikeType(text: string): AssessmentPromptType | null {
  const value = text.toLowerCase();
  if (value.includes("실험") || value.includes("변인")) return "실험탐구";
  if (value.includes("실생활") || value.includes("적용 전후")) return "실생활적용탐구";
  if (value.includes("질의응답") || value.includes("실제 발표")) return "실제발표";
  if (value.includes("카드뉴스") || value.includes("인포그래픽") || value.includes("포스터")) return "비발표자료";
  if (value.includes("조사") || value.includes("통계") || value.includes("문헌")) return "조사보고서";
  if (value.includes("탐구")) return "탐구보고서";
  return null;
}

function commonContext(assignment: AssignmentInput) {
  return {
    교육과정: assignment.curriculum,
    학교급: assignment.schoolLevel,
    학년: assignment.grade,
    과목: assignment.subject,
    단원: assignment.course,
    교사안내문: assignment.teacherInstruction,
    평가기준: assignment.rubricText,
    성취기준: assignment.achievementStandardText,
    필수요소: assignment.requiredElements,
    분량조건: assignment.lengthRule,
    형식조건: assignment.formatRule,
    학생자료와생각: assignment.studentIdeas,
  };
}

function routeForRun(route: ModelRoute, model: string): ModelRoute {
  return model === route.model ? route : { ...route, model };
}
