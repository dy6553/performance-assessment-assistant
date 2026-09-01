import type { AssignmentInput } from "./schemas";

export const assessmentFlowStorageKey = "assessment-wizard-draft-v1";
export const assessmentAnalysisStorageKey = "assessment-wizard-analysis-v1";
export const assessmentDraftStorageKey = "assessment-wizard-generated-draft-v1";
export const assessmentVerificationStorageKey = "assessment-wizard-verification-v1";

export const assessmentStorageBaseKeys = [
  assessmentFlowStorageKey,
  assessmentAnalysisStorageKey,
  assessmentDraftStorageKey,
  assessmentVerificationStorageKey,
] as const;

export function scopedAssessmentStorageKey(baseKey: string, storageScope: string) {
  return `${baseKey}::${storageScope}`;
}

export const assignmentTypeOptions = [
  {
    slug: "auto",
    value: "자동 분석",
    title: "자동 분석",
    shortTitle: "자동 분석",
    eyebrow: "AI 분류",
    description: "안내문을 바탕으로 AI가 수행평가 유형과 작성 전략을 먼저 판단합니다.",
  },
  {
    slug: "research-report",
    value: "조사보고서",
    title: "조사보고서",
    shortTitle: "조사보고서",
    eyebrow: "보고서형",
    description: "자료와 출처를 조사해 핵심 내용을 비교·정리하고 근거 중심의 조사보고서를 작성합니다.",
  },
  {
    slug: "inquiry-report",
    value: "탐구보고서",
    title: "탐구보고서",
    shortTitle: "탐구보고서",
    eyebrow: "보고서형",
    description: "탐구 문제, 과정, 분석, 결론의 흐름을 갖춘 탐구보고서를 단계별로 작성합니다.",
  },
  {
    slug: "presentation",
    value: "발표·토론",
    title: "발표·토론",
    shortTitle: "발표·토론",
    eyebrow: "발표형",
    description: "발표문, 발표 자료, 토론 주장과 근거를 과제 조건에 맞춰 설계합니다.",
  },
  {
    slug: "experiment",
    value: "실험·탐구",
    title: "실험·탐구",
    shortTitle: "실험·탐구",
    eyebrow: "탐구형",
    description: "가설, 변인, 관찰, 실험 과정과 결과 해석이 필요한 과제를 준비합니다.",
  },
] as const;

export type AssignmentTypeSlug = (typeof assignmentTypeOptions)[number]["slug"];
export type AssignmentTypeValue = (typeof assignmentTypeOptions)[number]["value"];

export const initialAssignment: AssignmentInput = {
  curriculum: "2022 개정 교육과정",
  schoolLevel: "고등학교",
  grade: 1,
  subject: "통합사회",
  course: "",
  assignmentType: "자동 분석",
  topic: "",
  teacherInstruction: "",
  rubricText: "",
  achievementStandardText: "",
  requiredElements: "",
  lengthRule: "",
  formatRule: "",
  studentIdeas: "",
};

export function getAssignmentTypeBySlug(slug: string) {
  return assignmentTypeOptions.find((item) => item.slug === slug) ?? null;
}

export function getAssignmentTypeByValue(value: string) {
  if (value === "조사·보고서") return assignmentTypeOptions.find((item) => item.slug === "research-report") ?? assignmentTypeOptions[0];
  return assignmentTypeOptions.find((item) => item.value === value) ?? assignmentTypeOptions[0];
}

export function getSetupPath(value: string) {
  return `/assignment/setup/${getAssignmentTypeByValue(value).slug}`;
}
