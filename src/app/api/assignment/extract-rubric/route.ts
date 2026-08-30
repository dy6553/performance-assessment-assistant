import { extractPdfRubric, extractRubricImages, type PdfRubricResult } from "@/features/assessment/server/pdf-rubric";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const DIRECT_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 6;
const MAX_COMPRESSED_PAYLOAD_CHARS = 3_400_000;
const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("application/json")) {
    return handleCompressedPages(request);
  }
  return handleDirectPdf(request);
}

async function handleCompressedPages(request: Request) {
  let payload: { fileName?: unknown; pageImages?: unknown };
  try {
    payload = (await request.json()) as { fileName?: unknown; pageImages?: unknown };
  } catch {
    return Response.json({ error: "압축된 PDF 요청을 읽지 못했습니다." }, { status: 400 });
  }

  if (!Array.isArray(payload.pageImages) || payload.pageImages.length < 1 || payload.pageImages.length > MAX_PAGES) {
    return Response.json({ error: `평가표 PDF는 ${MAX_PAGES}페이지 이하로 올려 주세요.` }, { status: 400 });
  }

  const pageImages = payload.pageImages.filter((value): value is string => typeof value === "string");
  if (
    pageImages.length !== payload.pageImages.length ||
    pageImages.some((image) => !image.startsWith(JPEG_DATA_URL_PREFIX))
  ) {
    return Response.json({ error: "압축된 PDF 페이지 형식이 올바르지 않습니다." }, { status: 415 });
  }

  const payloadChars = pageImages.reduce((total, image) => total + image.length, 0);
  if (payloadChars > MAX_COMPRESSED_PAYLOAD_CHARS) {
    return Response.json({ error: "PDF를 압축한 뒤에도 데이터가 너무 큽니다. 더 작은 PDF를 사용해 주세요." }, { status: 413 });
  }

  try {
    const result = await extractRubricImages(pageImages);
    return rubricResponse(result, sanitizeFileName(payload.fileName));
  } catch (error) {
    return Response.json({ error: publicApiError(error, "PDF를 판독하지 못했습니다.") }, { status: 502 });
  }
}

async function handleDirectPdf(request: Request) {
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
  if (file.size < 5 || file.size > DIRECT_FILE_BYTES) {
    return Response.json({ error: "큰 PDF는 브라우저 압축 방식으로 업로드해 주세요." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    return Response.json({ error: "올바른 PDF 파일이 아닙니다." }, { status: 422 });
  }

  try {
    const result = await extractPdfRubric(bytes);
    return rubricResponse(result, sanitizeFileName(file.name));
  } catch (error) {
    return Response.json({ error: publicApiError(error, "PDF를 판독하지 못했습니다.") }, { status: 502 });
  }
}

function rubricResponse(result: PdfRubricResult, fileName: string) {
  return Response.json(
    {
      fileName,
      rubricText: result.rubricText,
      transcription: result.transcription,
      uncertainText: result.uncertainText,
      pages: result.pages,
      model: result.model,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

function sanitizeFileName(value: unknown) {
  return (typeof value === "string" ? value : "평가표.pdf").replace(/[\r\n<>]/g, " ").slice(0, 200);
}
