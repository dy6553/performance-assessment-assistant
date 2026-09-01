import "server-only";

import {
  analysisResultSchema,
  draftResultSchema,
  verificationResultSchema,
  type AnalysisResult,
  type AssignmentInput,
  type DraftResult,
  type VerificationResult,
  type VerificationStatus,
} from "../schemas";
import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel, type ModelRoute } from "@/lib/ai/router";
import { composePostTopicPrompt, composeVerificationPrompt } from "./post-topic-prompts";
import {
  composeAssessmentPrompts,
  getAssessmentTypePrompt,
  type AssessmentPromptType,
} from "./type-prompts";

type RunResult<T> = { data: T; route: ModelRoute };

function promptTypes(assignment: AssignmentInput) {
  const raw = assignment.assignmentType.trim();
  const parts = raw.split(/\s*\+\s*|\s*\/\s*/).map((v) => v.trim()).filter(Boolean);
  const aliases: Record<string, string> = {
    "발표·토론": "실제발표", "발표": "실제발표", "실제 발표": "실제발표",
    "PPT": "비발표자료", "발표자료": "비발표자료", "비발표 자료": "비발표자료",
    "실험·탐구": "실험탐구", "실험": "실험탐구",
    "실생활 적용 탐구": "실생활적용탐구",
  };
  const normalized = parts.map((v) => aliases[v] ?? v).filter((v) => getAssessmentTypePrompt(v));
  return {
    primary: (normalized[0] ?? "탐구보고서") as AssessmentPromptType,
    secondary: normalized[1] as AssessmentPromptType | undefined,
  };
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

function selectedPrompt(assignment: AssignmentInput) {
  const { primary, secondary } = promptTypes(assignment);
  return [
    composeAssessmentPrompts(primary, secondary),
    "",
    "[프롬프트 라우팅 규칙]",
    `주 유형: ${primary}`,
    secondary ? `보조 유형: ${secondary}` : "보조 유형: 없음",
    "주 유형 하나만 선택된 경우 다른 유형의 지침을 추론하거나 섞지 마세요.",
    "복합 유형인 경우 위 두 유형의 지침만 사용하며, 서로 중복되는 지침은 한 번만 적용하세요.",
    "공통 입력 정보는 아래 사용자 메시지의 commonContext를 사용하세요.",
  ].join("\n");
}

function postTopicPrompt(assignment: AssignmentInput) {
  const { primary } = promptTypes(assignment);
  return [
    composePostTopicPrompt(primary),
    "",
    "[적용 시점 규칙]",
    "이 프롬프트 묶음은 주제 선정 단계에는 사용하지 않습니다.",
    "주제가 확정된 뒤 초안을 작성하는 순간부터 적용하며, 이후 초안 검증·수정 단계에도 계속 적용합니다.",
    `확정된 수행평가 유형: ${primary}`,
    "공통 입력 정보는 아래 사용자 메시지의 commonContext를 사용하고, 확정된 주제는 topic을 그대로 유지하세요.",
  ].join("\n");
}

function verificationStagePrompt(assignment: AssignmentInput) {
  const { primary } = promptTypes(assignment);
  return [
    composeVerificationPrompt(primary),
    "",
    "[검토 및 논리 검증 단계 전용 규칙]",
    "이 검토 프롬프트는 초안 작성 단계에는 사용하지 않고, 완성된 초안을 검토·논리검증·수정하는 단계에서만 추가 적용합니다.",
    `확정된 수행평가 유형: ${primary}`,
    "교사 안내문·평가기준 위반과 치명적 논리 오류를 문체 문제보다 먼저 찾으세요.",
    "주장–근거–해석, 숨은 전제, 반례·대안 설명, 사실·수치·출처, 실제 수행 여부, 학생 설명 가능성을 모두 내부적으로 점검하세요.",
    "비판적인 교사 관점의 Red Team 검증을 수행하고, 문제는 치명적→높음→중간→낮음 순으로 우선 처리하세요.",
    "수정이 필요하면 기존 학생의 실제 내용과 데이터는 보존하고 최소한의 수정만 하며, 수정 후 동일 기준으로 다시 검증하세요.",
    "공통 입력 정보는 아래 사용자 메시지의 commonContext를 사용하고, 확정된 주제는 topic을 그대로 유지하세요.",
  ].join("\n");
}

function routeForRun(route: ModelRoute, model: string): ModelRoute {
  return model === route.model ? route : { ...route, model };
}

export async function analyzeAssignment(assignment: AssignmentInput): Promise<RunResult<AnalysisResult>> {
  const route = await routeModel({
    task: "strategy",
    inputCharacters: JSON.stringify(assignment).length,
    context: { subject: assignment.subject, schoolLevel: assignment.schoolLevel, grade: assignment.grade, assignmentType: assignment.assignmentType, format: assignment.formatRule || assignment.course },
  });
  const outputContract = {
    taskType: { primary: "주 유형", secondary: ["보조 유형"], confidence: 0.9, reasons: ["근거"] },
    curriculum: { version: assignment.curriculum, status: "user_provided", basis: "사용자 선택" },
    requirements: { requiredSections: ["필수 구성"], requiredKeywords: [], prohibitedItems: [], teacherSpecificRules: [], length: { min: null, max: null, unit: "unknown" }, format: "제출 형식" },
    achievementStandards: [],
    rubricItems: [{ name: "평가요소", description: "판단 기준", weight: null, source: assignment.rubricText ? "teacher" : "temporary" }],
    strategy: { important: ["핵심"], rubricStrategies: [], recommendedStructure: ["구조"], mustInclude: [], deductionRisks: [], topicApplication: [] },
    warnings: [],
  };
  const run = await generateStructured({
    taskName: "assignment_analysis",
    model: route.model,
    fallbackModel: route.fallback,
    schema: analysisResultSchema,
    maxTokens: 7000,
    messages: [
      { role: "system", content: `${selectedPrompt(assignment)}\n\n분석 단계에서는 교사 안내문과 평가기준을 최우선으로 구조화하세요. JSON 객체만 출력하세요.\n\n출력 계약:\n${JSON.stringify(outputContract)}` },
      { role: "user", content: JSON.stringify({ commonContext: commonContext(assignment), topic: assignment.topic }) },
    ],
  });
  const data: AnalysisResult = {
    ...run.data,
    curriculum: { version: assignment.curriculum, status: "user_provided", basis: "사용자가 선택한 교육과정" },
    achievementStandards: assignment.achievementStandardText.trim() ? run.data.achievementStandards : [],
  };
  return { data, route: routeForRun(route, run.model) };
}

export async function generateDraft(assignment: AssignmentInput, analysis: AnalysisResult): Promise<RunResult<DraftResult>> {
  const route = await routeModel({
    task: "writer",
    inputCharacters: JSON.stringify({ assignment, analysis }).length,
    context: { subject: assignment.subject, schoolLevel: assignment.schoolLevel, grade: assignment.grade, assignmentType: assignment.assignmentType, format: assignment.formatRule || analysis.requirements.format || assignment.course },
  });
  const contract = { title: "제목", thesisOrGoal: "핵심 주장 또는 목표", sections: [{ heading: "소제목", body: "본문" }], claimCandidates: [], sourceNeeds: [], uncertainties: [] };
  const run = await generateStructured({
    taskName: "assignment_writer",
    model: route.model,
    fallbackModel: route.fallback,
    schema: draftResultSchema,
    maxTokens: 12000,
    messages: [
      { role: "system", content: `${postTopicPrompt(assignment)}\n\n선택된 유형의 작성 절차와 구조를 실제 초안에 적용하세요. 실제로 하지 않은 활동·결과·통계는 만들지 마세요. 이미 확정된 주제를 다른 주제로 바꾸거나 새 주제를 추천하지 마세요. JSON 객체만 출력하세요.\n\n출력 계약:${JSON.stringify(contract)}` },
      { role: "user", content: JSON.stringify({ commonContext: commonContext(assignment), topic: assignment.topic, analysis }) },
    ],
  });
  return { data: run.data, route: routeForRun(route, run.model) };
}

export async function verifyDraft(assignment: AssignmentInput, analysis: AnalysisResult, draft: DraftResult): Promise<RunResult<VerificationResult & { readinessScore: number }>> {
  const route = await routeModel({
    task: "logic_critic",
    inputCharacters: JSON.stringify({ assignment, analysis, draft }).length,
    context: { subject: assignment.subject, schoolLevel: assignment.schoolLevel, grade: assignment.grade, assignmentType: assignment.assignmentType, format: assignment.formatRule || analysis.requirements.format || assignment.course },
  });
  const check = { status: "PASS | PARTIAL | FAIL | NEEDS_WEB_VERIFICATION", evidence: [], issues: [], fixes: [] };
  const contract = { requirementCheck: check, curriculumCheck: check, rubricCheck: check, logicCheck: check, factSourceCheck: check, formatCheck: check, gradeLevelCheck: check, revisedDraft: null, summary: "검증 요약" };
  const run = await generateStructured({
    taskName: "assignment_verification",
    model: route.model,
    fallbackModel: route.fallback,
    schema: verificationResultSchema,
    maxTokens: 10000,
    temperature: 0.05,
    messages: [
      { role: "system", content: `${verificationStagePrompt(assignment)}\n\n최종 검토 결과를 호출부 JSON 계약에 맞게 구조화하세요. 외부 확인이 필요한 사실은 NEEDS_WEB_VERIFICATION으로 표시하세요. 확정된 주제와 실제 수행 사실을 유지하고, 수정본이 필요해도 존재하지 않는 활동·자료·결과를 추가하지 마세요. JSON 객체만 출력하세요.\n\n출력 계약:${JSON.stringify(contract)}` },
      { role: "user", content: JSON.stringify({ commonContext: commonContext(assignment), topic: assignment.topic, analysis, draft }) },
    ],
  });
  const statuses: VerificationStatus[] = [
    run.data.requirementCheck.status, run.data.curriculumCheck.status, run.data.rubricCheck.status,
    run.data.logicCheck.status, run.data.factSourceCheck.status, run.data.formatCheck.status, run.data.gradeLevelCheck.status,
  ];
  const scoreMap: Record<VerificationStatus, number> = { PASS: 100, PARTIAL: 65, FAIL: 20, NEEDS_WEB_VERIFICATION: 55 };
  const readinessScore = Math.round(statuses.reduce((sum, s) => sum + scoreMap[s], 0) / statuses.length);
  return { data: { ...run.data, readinessScore }, route: routeForRun(route, run.model) };
}
