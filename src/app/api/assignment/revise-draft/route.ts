import { z } from "zod";

import {
  analysisResultSchema,
  assignmentInputSchema,
  draftResultSchema,
} from "@/features/assessment/schemas";
import { applyCareerToAssignment, getCareerAiContext } from "@/features/assessment/server/career-context";
import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel } from "@/lib/ai/router";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const reviseDraftRequestSchema = z
  .object({
    assignment: assignmentInputSchema,
    analysis: analysisResultSchema,
    draft: draftResultSchema,
    instruction: z.string().trim().min(2).max(6_000),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = reviseDraftRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "초안과 수정 요청을 다시 확인해 주세요.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const career = await getCareerAiContext();
    const assignment = applyCareerToAssignment(parsed.data.assignment, career);
    const { analysis, draft, instruction } = parsed.data;
    const route = await routeModel({
      task: "final_rewriter",
      inputCharacters: JSON.stringify({ assignment, analysis, draft, instruction }).length,
    });

    const system = [
      "당신은 한국 학교 수행평가 초안을 수정하는 편집 도우미다.",
      "기존 초안을 버리고 무관한 새 글을 쓰지 말고, 사용자의 수정 요청을 중심으로 필요한 부분을 고친다.",
      "교사 안내문과 실제 루브릭, 앞 단계 작성 전략은 계속 준수한다.",
      "사용자가 직접 고친 내용과 핵심 주장·의도는 수정 요청과 충돌하지 않는 한 보존한다.",
      "분량, 말투, 구조, 난이도, 특정 내용 추가·삭제 같은 사용자의 원하는 조건을 구체적으로 반영한다.",
      "사용자 프로필의 진로 정보가 입력에 포함되어 있더라도 교사 안내·루브릭·교과 적합성을 우선하고 자연스럽게 연결 가능한 경우에만 참고한다.",
      "확인되지 않은 통계·정책·법·연도·연구 결과를 새로 만들어내지 않는다.",
      "외부 확인이 필요한 내용은 sourceNeeds 또는 uncertainties에 남긴다.",
      "학교 과제로 부적절하거나 위험한 활동을 권하지 않는다.",
      "반드시 JSON 객체 하나만 출력한다.",
    ].join("\n");

    const outputContract = {
      title: "수정된 제목",
      thesisOrGoal: "수정된 핵심 주장 또는 목표",
      sections: [{ heading: "소제목", body: "수정된 본문" }],
      claimCandidates: ["사실검증이 필요한 핵심 주장"],
      sourceNeeds: ["추가 공식 출처가 필요한 내용"],
      uncertainties: ["확실히 검증되지 않은 내용"],
    };

    const run = await generateStructured({
      taskName: "assignment_draft_revision",
      model: route.model,
      fallbackModel: route.fallback,
      schema: draftResultSchema,
      maxTokens: 12_000,
      temperature: 0.12,
      messages: [
        { role: "system", content: `${system}\n\n출력 계약: ${JSON.stringify(outputContract)}` },
        {
          role: "user",
          content: JSON.stringify({
            assignment,
            analysis,
            currentDraft: draft,
            revisionInstruction: instruction,
          }),
        },
      ],
    });

    return Response.json(
      {
        data: run.data,
        route: {
          ...route,
          model: run.model,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: publicApiError(error, "초안을 수정하지 못했습니다.") },
      { status: 502 },
    );
  }
}
