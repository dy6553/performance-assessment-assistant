import { extractPdfRubric, extractRubricImages, type AssessmentDocumentMode, type PdfRubricResult } from "@/features/assessment/server/pdf-rubric";
import { publicApiError } from "@/lib/http/server-error";

export const runtime = "nodejs";
export const maxDuration = 300;

const DIRECT_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 6;
const MAX_COMPRESSED_PAYLOAD_CHARS = 3_400_000;
const JPEG_PREFIX = "data:image/jpeg;base64,";
const SUPPORTED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  return contentType.includes("application/json") ? handleCompressed(request) : handleDirect(request);
}

async function handleCompressed(request: Request) {
  let payload: { fileName?: unknown; documentType?: unknown; pageImages?: unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: "압축된 문서 요청을 읽지 못했습니다." }, { status: 400 }); }
  const documentType = parseDocumentType(payload.documentType);
  if (!documentType) return Response.json({ error: "문서 종류를 확인하지 못했습니다." }, { status: 400 });
  if (!Array.isArray(payload.pageImages) || payload.pageImages.length < 1 || payload.pageImages.length > MAX_PAGES) return Response.json({ error: `문서는 ${MAX_PAGES}페이지 이하로 올려 주세요.` }, { status: 400 });
  const images = payload.pageImages.filter((value): value is string => typeof value === "string");
  if (images.length !== payload.pageImages.length || images.some(image => !image.startsWith(JPEG_PREFIX))) return Response.json({ error: "압축된 문서 형식이 올바르지 않습니다." }, { status: 415 });
  if (images.reduce((sum, image) => sum + image.length, 0) > MAX_COMPRESSED_PAYLOAD_CHARS) return Response.json({ error: "자동 압축 후에도 파일이 너무 큽니다. 페이지를 나누어 올려 주세요." }, { status: 413 });
  try { return documentResponse(await extractRubricImages(images, documentType), sanitizeFileName(payload.fileName)); }
  catch (error) { return Response.json({ error: publicApiError(error, "문서를 변환하거나 판독하지 못했습니다.") }, { status: 502 }); }
}

async function handleDirect(request: Request) {
  let formData: FormData; try { formData = await request.formData(); } catch { return Response.json({ error: "업로드 요청을 읽지 못했습니다." }, { status: 400 }); }
  const documentType = parseDocumentType(formData.get("documentType")); if (!documentType) return Response.json({ error: "문서 종류를 확인하지 못했습니다." }, { status: 400 });
  const file = formData.get("file"); if (!(file instanceof File)) return Response.json({ error: "PDF 또는 사진을 선택해 주세요." }, { status: 400 });
  if (file.size < 5 || file.size > DIRECT_FILE_BYTES) return Response.json({ error: "큰 파일은 기기 자동 압축 방식으로 올려 주세요." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer()); const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); const imageType = normalizedImageType(file);
  try {
    if (pdf) { if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") return Response.json({ error: "올바른 PDF 파일이 아닙니다." }, { status: 422 }); return documentResponse(await extractPdfRubric(bytes, documentType), sanitizeFileName(file.name)); }
    if (!imageType || !hasValidImageSignature(bytes, imageType)) return Response.json({ error: "올바른 JPG·PNG·WebP 사진이 아닙니다." }, { status: 422 });
    return documentResponse(await extractRubricImages([`data:${imageType};base64,${Buffer.from(bytes).toString("base64")}`], documentType), sanitizeFileName(file.name));
  } catch (error) { return Response.json({ error: publicApiError(error, "문서를 변환하거나 판독하지 못했습니다.") }, { status: 502 }); }
}

function normalizedImageType(file: File) { if (SUPPORTED_IMAGES.has(file.type)) return file.type; const name = file.name.toLowerCase(); if (/\.jpe?g$/.test(name)) return "image/jpeg"; if (name.endsWith(".png")) return "image/png"; if (name.endsWith(".webp")) return "image/webp"; return null; }
function hasValidImageSignature(bytes: Uint8Array, type: string) { if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff; if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47; return new TextDecoder("ascii").decode(bytes.subarray(0, 4)) === "RIFF" && new TextDecoder("ascii").decode(bytes.subarray(8, 12)) === "WEBP"; }
function documentResponse(result: PdfRubricResult, fileName: string) { return Response.json({ fileName, documentType: result.documentType, documentText: result.documentText, rubricText: result.documentType === "rubric" ? result.documentText : undefined, transcription: result.transcription, uncertainText: result.uncertainText, pages: result.pages, model: result.model }, { headers: { "Cache-Control": "private, no-store" } }); }
function parseDocumentType(value: unknown): AssessmentDocumentMode | null { if (value === undefined || value === null || value === "") return "auto"; return value === "auto" || value === "rubric" || value === "guide" ? value : null; }
function sanitizeFileName(value: unknown) { return (typeof value === "string" ? value : "수행평가 문서").replace(/[\r\n<>]/g, " ").slice(0, 200); }
