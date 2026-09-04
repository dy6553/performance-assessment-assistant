import { researchRequestSchema } from "@/features/assessment/stage-schemas";
import { applyCareerToAssignment, getCareerAiContext } from "@/features/assessment/server/career-context";
import { researchAssignmentEvidence } from "@/features/assessment/server/stage-service";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = researchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "수행평가 정보와 분석 결과를 다시 확인해 주세요.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const career = await getCareerAiContext(parsed.data.assignment.careerLinked);
    const assignment = applyCareerToAssignment(parsed.data.assignment, career);
    const result = await researchAssignmentEvidence(assignment, parsed.data.analysis, parsed.data.sourceNotes);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: publicApiError(error, "자료 조사·출처 검증 중 오류가 발생했습니다.") }, { status: 502 });
  }
}
