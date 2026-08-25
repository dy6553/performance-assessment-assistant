import { analyzeRequestSchema } from "@/features/assessment/schemas";
import { analyzeAssignment } from "@/features/assessment/server/service";

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
    const result = await analyzeAssignment(parsed.data.assignment);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: safeMessage(error) }, { status: 502 });
  }
}

function safeMessage(error: unknown) {
  return error instanceof Error ? error.message : "과제 분석 중 오류가 발생했습니다.";
}
