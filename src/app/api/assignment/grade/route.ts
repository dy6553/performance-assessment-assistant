import { gradingRequestSchema } from "@/features/grader/schemas";
import { gradeSubmission } from "@/features/grader/server/service";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "채점 요청을 읽지 못했습니다." }, { status: 400 });
  }

  const checked = gradingRequestSchema.safeParse(payload);
  if (!checked.success) {
    return Response.json(
      { error: "평가기준표, 수행평가 결과물, 채점 엄격도를 다시 확인해 주세요." },
      { status: 400 },
    );
  }

  try {
    const result = await gradeSubmission(checked.data);
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: publicApiError(error, "AI 채점을 완료하지 못했습니다.") }, { status: 502 });
  }
}
