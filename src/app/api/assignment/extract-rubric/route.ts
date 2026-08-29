import { extractPdfRubric } from "@/features/assessment/server/pdf-rubric";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "PDF 요청을 읽지 못했습니다." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "평가표 PDF를 선택해 주세요." }, { status: 400 });
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return Response.json({ error: "PDF 파일만 업로드할 수 있습니다." }, { status: 415 });
  }
  if (file.size < 5 || file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "PDF는 4MB 이하로 올려 주세요." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    return Response.json({ error: "올바른 PDF 파일이 아닙니다." }, { status: 422 });
  }

  try {
    const result = await extractPdfRubric(bytes);
    return Response.json(
      {
        fileName: file.name.replace(/[\r\n<>]/g, " ").slice(0, 200),
        rubricText: result.rubricText,
        transcription: result.transcription,
        uncertainText: result.uncertainText,
        pages: result.pages,
        model: result.model,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return Response.json({ error: publicApiError(error, "PDF를 판독하지 못했습니다.") }, { status: 502 });
  }
}
