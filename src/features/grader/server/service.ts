import "server-only";

import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel, type ModelRoute } from "@/lib/ai/router";

import {
  gradingAiResultSchema,
  type GradingAiResult,
  type GradingRequest,
  type GradingResult,
} from "../schemas";

type RunResult<T> = { data: T; route: ModelRoute };

const strictnessProfiles: Record<number, { label: string; instruction: string }> = {
  1: {
    label: "1단계 · 관대",
    instruction: "핵심 취지가 충족되면 부분점수를 넉넉히 주고, 사소한 표현·형식 부족은 최소한으로 감점한다.",
  },
  2: {
    label: "2단계 · 약간 관대",
    instruction: "평가기준을 따르되 명확한 노력과 부분 충족에는 비교적 충분한 부분점수를 준다.",
  },
  3: {
    label: "3단계 · 보통",
    instruction: "평가기준의 문구와 배점을 일반적인 학교 채점 수준으로 그대로 적용한다.",
  },
  4: {
    label: "4단계 · 엄격",
    instruction: "평가기준 충족 근거가 결과물에 명확히 드러나야 점수를 주고, 모호하거나 불완전한 충족은 적극 감점한다.",
  },
  5: {
    label: "5단계 · 매우 엄격",
    instruction: "평가기준을 문언 그대로 매우 엄격하게 적용한다. 결과물에 직접 확인되는 근거만 인정하고, 누락·모호함·근거 부족은 높은 폭으로 감점한다.",
  },
};

export async function gradeSubmission(input: GradingRequest): Promise<RunResult<GradingResult>> {
  const profile = strictnessProfiles[input.strictness] ?? strictnessProfiles[3];
  const route = await routeModel({
    task: "rubric_grader",
    inputCharacters: input.rubricText.length + input.submissionText.length,
  });

  const system = [
    "당신은 한국 학교 수행평가의 평가기준표 기반 AI 채점기다.",
    "교사가 제공한 평가기준표의 항목, 수행수준, 배점, 필수조건을 최우선으로 적용한다.",
    "학생 결과물에 실제로 적힌 내용만 채점 근거로 사용하고, 학생의 의도나 빠진 내용을 추측해서 점수를 주지 않는다.",
    "평가기준표에 명시된 배점이 있으면 항목별 maxScore를 반드시 그 배점과 일치시키고 scoreBasis를 explicit_points로 한다.",
    "평가기준표에 숫자 배점이 전혀 없다면 평가항목의 중요도를 반영해 총점 100점으로 배분하고 scoreBasis를 normalized_100으로 한다.",
    "각 criterion의 earnedScore는 0 이상 maxScore 이하이어야 한다.",
    "evidence에는 학생 결과물에서 해당 점수 판단에 사용한 짧은 근거 위치나 문구만 적는다.",
    "감점 이유는 평가기준표의 어느 조건이 부족한지 구체적으로 설명한다.",
    "평가기준표에 없는 새로운 평가항목을 임의로 만들어 감점하지 않는다.",
    "맞춤법이나 문체는 평가기준표에 관련 항목이 있을 때만 독립적인 감점 근거로 삼는다.",
    "외부 사실 검증이 필요한 내용은 사실 여부를 확정하지 말고 warnings에 남긴다.",
    `채점 엄격도: ${profile.label}. ${profile.instruction}`,
    "JSON 객체 하나만 출력한다.",
  ].join("\n");

  const outputContract = {
    rubricTitle: "평가기준표를 요약한 제목",
    scoreBasis: "explicit_points 또는 normalized_100",
    criteria: [
      {
        criterion: "평가항목",
        maxScore: 20,
        earnedScore: 16,
        evidence: ["결과물의 실제 근거"],
        reason: "이 점수를 준 이유와 부족한 점",
      },
    ],
    overallFeedback: "전체 채점 총평",
    strengths: ["잘 충족한 점"],
    deductions: ["핵심 감점 이유"],
    nextActions: ["점수를 올리기 위해 고칠 부분"],
    confidence: 0.9,
    warnings: ["교사가 최종 확인해야 할 부분"],
  };

  const run = await generateStructured({
    taskName: "assignment_rubric_grading",
    model: route.model,
    fallbackModel: route.fallback,
    schema: gradingAiResultSchema,
    maxTokens: 8_000,
    temperature: 0.05,
    messages: [
      {
        role: "system",
        content: `${system}\n\n출력 계약:\n${JSON.stringify(outputContract)}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          strictness: input.strictness,
          strictnessLabel: profile.label,
          rubricText: input.rubricText,
          submissionText: input.submissionText,
        }),
      },
    ],
  });

  const normalized = normalizeScores(run.data);
  return {
    data: {
      ...normalized,
      strictness: input.strictness,
      strictnessLabel: profile.label,
    },
    route: { ...route, model: run.model },
  };
}

function normalizeScores(result: GradingAiResult): Omit<GradingResult, "strictness" | "strictnessLabel"> {
  let criteria = result.criteria.map((criterion) => ({
    ...criterion,
    maxScore: roundScore(criterion.maxScore),
    earnedScore: roundScore(Math.min(criterion.maxScore, Math.max(0, criterion.earnedScore))),
  }));

  let maxScore = criteria.reduce((total, criterion) => total + criterion.maxScore, 0);

  if (result.scoreBasis === "normalized_100" && maxScore > 0 && Math.abs(maxScore - 100) > 0.05) {
    const scale = 100 / maxScore;
    criteria = criteria.map((criterion) => ({
      ...criterion,
      maxScore: roundScore(criterion.maxScore * scale),
      earnedScore: roundScore(criterion.earnedScore * scale),
    }));
    maxScore = criteria.reduce((total, criterion) => total + criterion.maxScore, 0);
  }

  const score = criteria.reduce((total, criterion) => total + Math.min(criterion.earnedScore, criterion.maxScore), 0);
  const safeMax = Math.max(maxScore, 0.1);

  return {
    ...result,
    criteria,
    score: roundScore(score),
    maxScore: roundScore(maxScore),
    percentage: Math.max(0, Math.min(100, roundScore((score / safeMax) * 100))),
  };
}

function roundScore(value: number) {
  return Math.round(value * 10) / 10;
}
