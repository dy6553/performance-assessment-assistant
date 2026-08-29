import { topicRecommendationRequestSchema } from "@/features/assessment/schemas";
import { recommendTopics } from "@/features/assessment/server/service";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = topicRecommendationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "과목과 수행평가 유형을 확인해 주세요.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await recommendTopics(parsed.data);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: publicApiError(error, "주제를 추천하지 못했습니다.") }, { status: 502 });
  }
}
