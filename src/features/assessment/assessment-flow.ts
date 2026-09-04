import type { AssignmentInput } from "./schemas";

export const assessmentFlowStorageKey = "assessment-wizard-draft-v1";
export const assessmentAnalysisStorageKey = "assessment-wizard-analysis-v1";
export const assessmentDraftStorageKey = "assessment-wizard-generated-draft-v1";
export const assessmentVerificationStorageKey = "assessment-wizard-verification-v1";

export const assessmentStorageBaseKeys = [assessmentFlowStorageKey, assessmentAnalysisStorageKey, assessmentDraftStorageKey, assessmentVerificationStorageKey] as const;

export function scopedAssessmentStorageKey(baseKey: string, storageScope: string) { return `${baseKey}::${storageScope}`; }

export const assignmentTypeOptions = [
  { slug: "auto", value: "자동 분석", title: "자동 분석", shortTitle: "자동 분석", eyebrow: "AI 분류", description: "안내문을 바탕으로 AI가 수행평가 유형과 작성 전략을 먼저 판단합니다." },
  { slug: "research-report", value: "조사보고서", title: "조사보고서", shortTitle: "조사보고서", eyebrow: "보고서형", description: "문헌·통계·사례를 기준에 따라 비교하고 출처를 검증하는 조사보고서입니다." },
  { slug: "inquiry-report", value: "탐구보고서", title: "탐구보고서", shortTitle: "탐구보고서", eyebrow: "탐구형", description: "탐구 질문부터 방법·분석·결론까지 논리적으로 연결하는 탐구보고서입니다." },
  { slug: "presentation", value: "실제발표", title: "실제 발표", shortTitle: "실제 발표", eyebrow: "발표형", description: "슬라이드·발표 대본·시간 배분·질의응답까지 실제 발표에 맞춰 준비합니다." },
  { slug: "visual-material", value: "비발표자료", title: "비발표 자료", shortTitle: "비발표 자료", eyebrow: "시각자료형", description: "PPT·카드뉴스·포스터처럼 발표 없이 자료만 제출하는 수행평가입니다." },
  { slug: "experiment", value: "실험탐구", title: "실험 탐구", shortTitle: "실험 탐구", eyebrow: "실험형", description: "가설·변인·반복 측정·오차·안전을 중심으로 재현 가능한 실험을 설계합니다." },
  { slug: "real-life-inquiry", value: "실생활적용탐구", title: "실생활 적용 탐구", shortTitle: "실생활 적용", eyebrow: "문제해결형", description: "교과 지식을 실제 문제에 적용하고 효과를 측정하는 문제 해결형 탐구입니다." },
] as const;

export type AssignmentTypeSlug = (typeof assignmentTypeOptions)[number]["slug"];
export type AssignmentTypeValue = (typeof assignmentTypeOptions)[number]["value"];

export const initialAssignment: AssignmentInput = {
  curriculum: "2022 개정 교육과정", schoolLevel: "고등학교", grade: 1, subject: "통합사회", course: "", assignmentType: "자동 분석", careerLinked: null, topic: "", teacherInstruction: "", rubricText: "", achievementStandardText: "", requiredElements: "", lengthRule: "", formatRule: "", studentIdeas: "",
};

export function getAssignmentTypeBySlug(slug: string) { return assignmentTypeOptions.find((item) => item.slug === slug) ?? null; }

export function getAssignmentTypeByValue(value: string) {
  const primary = value.split(/\s*\+\s*|\s*\/\s*/)[0]?.trim();
  const aliases: Record<string, string> = { "조사·보고서": "조사보고서", "발표·토론": "실제발표", "실험·탐구": "실험탐구" };
  const normalized = aliases[primary] ?? primary;
  return assignmentTypeOptions.find((item) => item.value === normalized) ?? assignmentTypeOptions[0];
}

export function getSetupPath(value: string) { return `/assignment/setup/${getAssignmentTypeByValue(value).slug}`; }
