import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AssessmentPromptType } from "../type-prompts";

const promptDir = join(process.cwd(), "src/features/assessment/server/post-topic-prompts");

function readPrompt(fileName: string) {
  return readFileSync(join(promptDir, fileName), "utf-8").trim();
}

const integratedPrompt = readPrompt("integrated.txt");
const finalReviewLogicPrompt = readPrompt("final-review-logic.txt");

const typePromptFiles: Record<AssessmentPromptType, string> = {
  "조사보고서": "research-report.txt",
  "탐구보고서": "inquiry-report.txt",
  "실제발표": "live-presentation.txt",
  "비발표자료": "non-presentation.txt",
  "실험탐구": "experiment.txt",
  "실생활적용탐구": "real-life.txt",
};

export function composePostTopicPrompt(type: AssessmentPromptType) {
  const typePrompt = readPrompt(typePromptFiles[type]);
  return [
    "[수행평가 통합 프롬프트 — 항상 적용]",
    integratedPrompt,
    "",
    `[자동선택된 초안 유형: ${type}]`,
    "아래 6개 전용 프롬프트 중 현재 유형에 해당하는 이 프롬프트 하나만 추가 적용합니다.",
    "나머지 5개 전용 프롬프트는 적용하거나 추론하여 섞지 마세요.",
    "주제는 이미 확정되었습니다. 주제 후보 생성·재추천 단계는 건너뛰고 현재 주제로 초안 작성과 이후 검증을 진행하세요.",
    "",
    "[선택된 유형 전용 프롬프트]",
    typePrompt,
  ].join("\n");
}

export function composeVerificationPrompt(type: AssessmentPromptType) {
  return [
    composePostTopicPrompt(type),
    "",
    "[최종 검토·논리검증 전용 프롬프트 — 검증 단계에서만 추가 적용]",
    finalReviewLogicPrompt,
    "",
    "[검증 단계 라우팅 규칙]",
    `이미 확정된 활성 유형은 ${type}입니다. 이 유형 하나만 검증 모듈로 사용하세요.`,
    "최종 검토 프롬프트 안의 자동선택 규칙은 현재 확정 유형을 재분류하기 위한 것이 아니라, 해당 유형의 검증 기준을 적용하기 위한 규칙으로 해석하세요.",
    "나머지 5개 유형의 검증 모듈은 완전히 무시하세요.",
    "초안을 새로 처음부터 작성하지 말고, 기존 결과물을 비판적으로 검토한 뒤 필요한 경우에만 최소 수정안을 만드세요.",
    "호출부의 JSON 출력 계약을 반드시 지키고, 상세 검토 결과는 evidence·issues·fixes·summary와 revisedDraft에 구조화하여 반영하세요.",
  ].join("\n");
}
