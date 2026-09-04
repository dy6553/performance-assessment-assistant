import { generateRequestSchema } from "@/features/assessment/schemas";
import { applyCareerToAssignment, getCareerAiContext } from "@/features/assessment/server/career-context";
import { generateDraft } from "@/features/assessment/server/prompted-service";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "분석 결과와 수행평가 정보를 다시 확인해 주세요.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const career = await getCareerAiContext(parsed.data.assignment.careerLinked);
    const result = await generateDraft(
      applyCareerToAssignment(parsed.data.assignment, career),
      parsed.data.analysis,
    );
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: publicApiError(error, "초안 작성 중 오류가 발생했습니다.") }, { status: 502 });
  }
}
