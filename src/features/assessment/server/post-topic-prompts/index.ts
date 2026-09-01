import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AssessmentPromptType } from "../type-prompts";

const promptDir = join(process.cwd(), "src/features/assessment/server/post-topic-prompts");

function readPrompt(fileName: string) {
  return readFileSync(join(promptDir, fileName), "utf-8").trim();
}

const integratedPrompt = readPrompt("integrated.txt");

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
