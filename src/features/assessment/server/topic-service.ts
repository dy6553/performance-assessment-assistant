import "server-only";

import {
  topicRecommendationResultSchema,
  type TopicRecommendationRequest,
  type TopicRecommendationResult,
} from "../schemas";
import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel, type ModelRoute } from "@/lib/ai/router";
import { composeTopicSelectionPrompts } from "./topic-selection-prompts";

type RunResult<T> = {
  data: T;
  route: ModelRoute;
  promptRouting: {
    integratedPromptApplied: true;
    selectedType: string;
    reason: string;
  };
};

export async function recommendTopics(
  input: TopicRecommendationRequest,
): Promise<RunResult<TopicRecommendationResult>> {
  const promptRouting = composeTopicSelectionPrompts(input);
  const route = await routeModel({
    task: "task_parser",
    inputCharacters: JSON.stringify(input).length + promptRouting.combinedPrompt.length,
    context: {
      subject: input.subject,
      schoolLevel: input.schoolLevel,
      grade: input.grade,
      assignmentType: promptRouting.selectedType,
      format: input.formatRule || input.course,
    },
  });

  const commonContext = {
    교육과정: input.curriculum,
    학교급: input.schoolLevel,
    학년: input.grade,
    과목: input.subject,
    단원: input.course,
    수행평가유형: input.assignmentType,
    자동선택된주제선정유형: promptRouting.selectedType,
    교사안내문: input.teacherInstruction,
    평가기준표루브릭: input.rubricText,
    성취기준: input.achievementStandardText,
    제출형식: input.formatRule,
    분량시간: input.lengthRule,
    추가요구사항: input.requiredElements,
    학생아이디어와준비자료: input.studentIdeas,
    관심분야: input.interestField,
    희망전공: input.desiredMajor,
    희망진로: input.desiredCareer,
    기타조건: input.additionalConditions,
    피하고싶은주제: input.avoidTopics,
  };

  const appExecutionRules = [
    "[수행도우미 주제선정 실행 규칙]",
    "위의 ‘주제 선정 통합본’은 매 요청마다 반드시 적용한다.",
    `이번 요청에서 활성화할 전용 프롬프트는 정확히 하나이며 '${promptRouting.selectedType}'이다.`,
    "선택된 전용 프롬프트만 추가 적용하고 나머지 5개 전용 프롬프트의 규칙은 섞지 않는다.",
    `자동선택 근거: ${promptRouting.reason}`,
    "통합본과 전용 프롬프트가 요구하는 평가기준 역설계, 후보 탈락, 타당성 검토, 점수화를 내부 판단 과정에 실제로 반영한다.",
    "이 API에는 실시간 웹 검색 도구가 연결되어 있지 않다. 실제로 검색하지 않은 자료의 존재·최신성·통계값·출처를 확인했다고 표현하지 않는다.",
    "현재 화면의 출력 계약 때문에 중간 표와 긴 검토 보고서는 출력하지 말고, 내부 검토를 통과한 최종 후보 정확히 5개만 JSON으로 반환한다.",
    "각 rationale에는 평가기준 적합성, 교과 연결, 수행 가능성, 자료/데이터 확보 전략, 분석 가능성 중 핵심 근거를 압축해서 설명한다.",
    "학생이 실제로 하지 않은 실험·조사·측정·인터뷰 결과를 만들어내지 않는다.",
    "JSON 객체 하나만 출력한다.",
  ].join("\n");

  const run = await generateStructured({
    taskName: "assignment_topic_recommendation",
    model: route.model,
    fallbackModel: route.fallback,
    schema: topicRecommendationResultSchema,
    maxTokens: 4_500,
    temperature: 0.25,
    messages: [
      {
        role: "system",
        content: `${promptRouting.combinedPrompt}\n\n${appExecutionRules}\n\n출력 계약: ${JSON.stringify({
          topics: [
            {
              title: "교과 개념 + 구체적 대상/현상 + 분석 가능한 질문 형태의 주제",
              rationale: "평가기준·교과연계·수행가능성·자료확보·분석가능성을 압축한 추천 근거",
            },
          ],
        })}`,
      },
      {
        role: "user",
        content: JSON.stringify({ commonContext }),
      },
    ],
  });

  return {
    data: run.data,
    route: routeForRun(route, run.model),
    promptRouting: {
      integratedPromptApplied: true,
      selectedType: promptRouting.selectedType,
      reason: promptRouting.reason,
    },
  };
}

function routeForRun(route: ModelRoute, model: string): ModelRoute {
  return model === route.model ? route : { ...route, model };
}
