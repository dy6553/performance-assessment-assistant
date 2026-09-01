import { verifyRequestSchema } from "@/features/assessment/schemas";
import { verifyDraft } from "@/features/assessment/server/prompted-service";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = verifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "초안과 분석 결과를 다시 확인해 주세요.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await verifyDraft(parsed.data.assignment, parsed.data.analysis, parsed.data.draft);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: publicApiError(error, "초안 검증 중 오류가 발생했습니다.") }, { status: 502 });
  }
}
