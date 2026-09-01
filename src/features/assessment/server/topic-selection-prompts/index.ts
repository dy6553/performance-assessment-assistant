import "server-only";

import type { TopicRecommendationRequest } from "../../schemas";
import { experimentTopicSelectionPrompt } from "./experiment";
import { inquiryReportTopicSelectionPrompt } from "./inquiry-report";
import { integratedTopicSelectionPrompt } from "./integrated";
import { livePresentationTopicSelectionPrompt } from "./live-presentation";
import { nonPresentationTopicSelectionPrompt } from "./non-presentation";
import { realLifeTopicSelectionPrompt } from "./real-life";
import { researchReportTopicSelectionPrompt } from "./research-report";

export const topicSelectionPromptTypes = [
  "조사보고서",
  "탐구보고서",
  "실제발표",
  "비발표자료",
  "실험탐구",
  "실생활적용탐구",
] as const;

export type TopicSelectionPromptType = (typeof topicSelectionPromptTypes)[number];

const typePrompts: Record<TopicSelectionPromptType, string> = {
  조사보고서: researchReportTopicSelectionPrompt,
  탐구보고서: inquiryReportTopicSelectionPrompt,
  실제발표: livePresentationTopicSelectionPrompt,
  비발표자료: nonPresentationTopicSelectionPrompt,
  실험탐구: experimentTopicSelectionPrompt,
  실생활적용탐구: realLifeTopicSelectionPrompt,
};

const explicitAliases: Record<string, TopicSelectionPromptType> = {
  조사보고서: "조사보고서",
  "조사 보고서": "조사보고서",
  탐구보고서: "탐구보고서",
  "탐구 보고서": "탐구보고서",
  실제발표: "실제발표",
  "실제 발표": "실제발표",
  발표: "실제발표",
  "발표·토론": "실제발표",
  비발표자료: "비발표자료",
  "비발표 자료": "비발표자료",
  발표자료: "비발표자료",
  PPT: "비발표자료",
  실험탐구: "실험탐구",
  "실험 탐구": "실험탐구",
  실험: "실험탐구",
  "실험·탐구": "실험탐구",
  실생활적용탐구: "실생활적용탐구",
  "실생활 적용 탐구": "실생활적용탐구",
};

type Detection = {
  selectedType: TopicSelectionPromptType;
  reason: string;
};

export function detectTopicSelectionPromptType(input: TopicRecommendationRequest): Detection {
  const explicitParts = input.assignmentType
    .split(/\s*\+\s*|\s*\/\s*/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const part of explicitParts) {
    const explicit = explicitAliases[part];
    if (explicit) {
      return {
        selectedType: explicit,
        reason: `사용자가 선택한 수행평가 유형(${part})을 최우선으로 적용`,
      };
    }
  }

  const text = [
    input.assignmentType,
    input.formatRule,
    input.teacherInstruction,
    input.rubricText,
    input.course,
    input.requiredElements,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const scores: Record<TopicSelectionPromptType, number> = {
    조사보고서: 0,
    탐구보고서: 0,
    실제발표: 0,
    비발표자료: 0,
    실험탐구: 0,
    실생활적용탐구: 0,
  };

  addScores(scores, text, "실험탐구", [
    ["실험", 5], ["가설", 4], ["독립변인", 5], ["종속변인", 5], ["통제변인", 4],
    ["반복 측정", 4], ["오차", 3], ["대조군", 3], ["측정값", 2],
  ]);
  addScores(scores, text, "실생활적용탐구", [
    ["실생활", 5], ["문제 해결", 4], ["적용 전후", 5], ["개선", 2], ["사용자", 3],
    ["학교 문제", 3], ["지역사회", 3], ["성과지표", 3], ["효과 측정", 4],
  ]);
  addScores(scores, text, "실제발표", [
    ["질의응답", 5], ["발표 시간", 4], ["발표대본", 4], ["발표 대본", 4], ["실제 발표", 5],
    ["청중", 3], ["발표", 2], ["토론", 2],
  ]);
  addScores(scores, text, "비발표자료", [
    ["비발표", 6], ["발표 없음", 6], ["카드뉴스", 5], ["인포그래픽", 5], ["포스터", 4],
    ["ppt", 2], ["시각자료", 2], ["시각 자료", 2],
  ]);
  addScores(scores, text, "조사보고서", [
    ["조사보고서", 6], ["자료 조사", 4], ["통계", 3], ["여러 출처", 4], ["문헌", 3],
    ["자료 비교", 4], ["공공자료", 3], ["공식 자료", 2],
  ]);
  addScores(scores, text, "탐구보고서", [
    ["탐구보고서", 6], ["탐구 문제", 4], ["탐구 질문", 4], ["탐구 과정", 4],
    ["과정", 1], ["분석", 2], ["결론", 1], ["관계", 1],
  ]);

  const ranked = topicSelectionPromptTypes
    .map((type, index) => ({ type, score: scores[type], index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (ranked[0].score > 0) {
    return {
      selectedType: ranked[0].type,
      reason: `교사 안내·평가기준·제출 형식의 단서로 자동 판별(점수 ${ranked[0].score})`,
    };
  }

  return {
    selectedType: "탐구보고서",
    reason: "유형 단서가 부족해 일반적인 탐구 과정 중심 유형을 기본값으로 적용",
  };
}

export function composeTopicSelectionPrompts(input: TopicRecommendationRequest) {
  const detection = detectTopicSelectionPromptType(input);
  return {
    ...detection,
    integratedPrompt: integratedTopicSelectionPrompt,
    selectedPrompt: typePrompts[detection.selectedType],
    combinedPrompt: [
      "[주제 선정 통합본 — 항상 적용]",
      integratedTopicSelectionPrompt,
      "",
      `[자동선택된 전용 유형: ${detection.selectedType}]`,
      `[자동선택 근거: ${detection.reason}]`,
      typePrompts[detection.selectedType],
    ].join("\n"),
  };
}

function addScores(
  scores: Record<TopicSelectionPromptType, number>,
  text: string,
  type: TopicSelectionPromptType,
  rules: Array<[string, number]>,
) {
  for (const [keyword, weight] of rules) {
    if (text.includes(keyword.toLowerCase())) scores[type] += weight;
  }
}
