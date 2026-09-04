import { analyzeRequestSchema } from "@/features/assessment/schemas";
import { applyCareerToAssignment, getCareerAiContext } from "@/features/assessment/server/career-context";
import { analyzeAssignment } from "@/features/assessment/server/prompted-service";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = analyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "수행평가 기본 정보와 교사 안내문을 확인해 주세요.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const career = await getCareerAiContext();
    const result = await analyzeAssignment(applyCareerToAssignment(parsed.data.assignment, career));
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: publicApiError(error, "과제 분석 중 오류가 발생했습니다.") }, { status: 502 });
  }
}
