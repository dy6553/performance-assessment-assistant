import { z } from "zod";

import { generateStructured } from "@/lib/ai/nvidia";
import { routeModel } from "@/lib/ai/router";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const typeSchema = z.enum([
  "조사보고서",
  "탐구보고서",
  "실제발표",
  "비발표자료",
  "실험탐구",
  "실생활적용탐구",
]);

const requestSchema = z.object({
  curriculum: z.string().trim().min(1).max(120),
  schoolLevel: z.string().trim().min(1).max(40),
  grade: z.number().int().min(1).max(6),
  subject: z.string().trim().min(1).max(80),
  course: z.string().trim().max(120).default(""),
  teacherInstruction: z.string().trim().min(2).max(20_000),
  rubricText: z.string().trim().max(20_000).default(""),
  achievementStandardText: z.string().trim().max(8_000).default(""),
}).strict();

const resultSchema = z.object({
  primaryType: typeSchema,
  secondaryType: typeSchema.nullable(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().trim().min(1).max(500)).min(1).max(5),
}).strict();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "과목과 교사 안내문 등 공통 정보를 확인해 주세요." }, { status: 400 });
  }

  try {
    const input = parsed.data;
    const route = await routeModel({
      task: "task_parser",
      inputCharacters: JSON.stringify(input).length,
      context: {
        subject: input.subject,
        schoolLevel: input.schoolLevel,
        grade: input.grade,
        assignmentType: "자동 분석",
        format: input.course,
      },
    });

    const system = [
      "당신은 수행평가 유형 분류기다. 이 단계에서는 유형별 작성 프롬프트를 사용하지 않는다.",
      "교사 안내문과 평가기준을 최우선으로 읽고 아래 6개 유형 중 가장 적합한 주 유형 하나를 추천한다.",
      "허용 유형: 조사보고서, 탐구보고서, 실제발표, 비발표자료, 실험탐구, 실생활적용탐구.",
      "복합 수행평가가 명확할 때만 보조 유형 하나를 추천한다. 단일 유형이면 secondaryType은 null이다.",
      "조사보고서는 문헌·통계·사례 비교가 핵심, 탐구보고서는 탐구 질문·방법·분석·결론 연결이 핵심이다.",
      "실제발표는 학생이 실제로 말하고 질의응답하는 과제, 비발표자료는 PPT·포스터·카드뉴스 등 자료만 제출하는 과제다.",
      "실험탐구는 변인·측정·반복·오차가 핵심, 실생활적용탐구는 실제 문제 해결안 설계·적용·효과 측정이 핵심이다.",
      "애매하면 confidence를 낮추고 이유에 확인할 지점을 적는다.",
      "추천은 확정이 아니며 최종 선택은 사용자가 한다.",
      "JSON 객체 하나만 출력한다.",
    ].join("\n");

    const run = await generateStructured({
      taskName: "assignment_type_recommendation",
      model: route.model,
      fallbackModel: route.fallback,
      schema: resultSchema,
      temperature: 0.1,
      maxTokens: 1_500,
      messages: [
        {
          role: "system",
          content: `${system}\n\n출력 계약: ${JSON.stringify({ primaryType: "조사보고서", secondaryType: null, confidence: 0.9, reasons: ["교사 안내문 근거"] })}`,
        },
        { role: "user", content: JSON.stringify(input) },
      ],
    });

    const data = run.data.secondaryType === run.data.primaryType
      ? { ...run.data, secondaryType: null }
      : run.data;

    return Response.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: publicApiError(error, "수행평가 유형 추천 중 오류가 발생했습니다.") }, { status: 502 });
  }
}
