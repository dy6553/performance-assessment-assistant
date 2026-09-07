import {
  extractPdfRubric,
  extractRubricImages,
  type AssessmentDocumentMode,
  type PdfRubricResult,
} from "@/features/assessment/server/pdf-rubric";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const SUPPORTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "업로드 요청을 읽지 못했습니다." }, { status: 400 });
  }

  const documentType = parseDocumentType(formData.get("documentType"));
  if (!documentType) return Response.json({ error: "문서 종류를 확인하지 못했습니다." }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "PDF 또는 사진을 선택해 주세요." }, { status: 400 });
  if (file.size < 5 || file.size > MAX_FILE_BYTES) {
    return Response.json({ error: "파일은 4MB 이하로 올려 주세요." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const imageType = normalizedImageType(file);

  try {
    if (pdf) {
      if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
        return Response.json({ error: "올바른 PDF 파일이 아닙니다." }, { status: 422 });
      }
      const result = await extractPdfRubric(bytes, documentType);
      return documentResponse(result, sanitizeFileName(file.name));
    }

    if (!imageType || !hasValidImageSignature(bytes, imageType)) {
      return Response.json({ error: "올바른 JPG·PNG·WebP 사진이 아닙니다." }, { status: 422 });
    }
    const dataUrl = `data:${imageType};base64,${Buffer.from(bytes).toString("base64")}`;
    const result = await extractRubricImages([dataUrl], documentType);
    return documentResponse(result, sanitizeFileName(file.name));
  } catch (error) {
    return Response.json({ error: publicApiError(error, "문서를 변환하거나 판독하지 못했습니다.") }, { status: 502 });
  }
}

function normalizedImageType(file: File) {
  if (SUPPORTED_IMAGES.has(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return null;
}

function hasValidImageSignature(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  return new TextDecoder("ascii").decode(bytes.subarray(0, 4)) === "RIFF"
    && new TextDecoder("ascii").decode(bytes.subarray(8, 12)) === "WEBP";
}

function documentResponse(result: PdfRubricResult, fileName: string) {
  return Response.json({
    fileName,
    documentType: result.documentType,
    documentText: result.documentText,
    rubricText: result.documentType === "rubric" ? result.documentText : undefined,
    transcription: result.transcription,
    uncertainText: result.uncertainText,
    pages: result.pages,
    model: result.model,
  }, { headers: { "Cache-Control": "private, no-store" } });
}

function parseDocumentType(value: unknown): AssessmentDocumentMode | null {
  if (value === undefined || value === null || value === "") return "auto";
  return value === "auto" || value === "rubric" || value === "guide" ? value : null;
}

function sanitizeFileName(value: unknown) {
  return (typeof value === "string" ? value : "수행평가 문서").replace(/[\r\n<>]/g, " ").slice(0, 200);
}
