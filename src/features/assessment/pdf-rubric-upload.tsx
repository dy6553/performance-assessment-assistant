"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/http/client-response";
import { saveCurrentProjectFile } from "@/lib/local-data/files";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_BATCH_FILES = 10;
const MAX_PAGES = 6;
const RENDER_LONG_EDGE = 1_400;
const JPEG_QUALITY = 0.68;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type DocumentType = "rubric" | "guide";
type DocumentMode = DocumentType | "auto";
type RubricPayload = { documentType?: DocumentType; documentText?: string; rubricText?: string; pages?: number; uncertainText?: string[]; error?: string };

export function PdfRubricUpload({ disabled, onExtracted, onGuideExtracted, documentTypes }: {
  disabled: boolean;
  onExtracted: (text: string) => void;
  onGuideExtracted?: (text: string) => void;
  documentTypes?: DocumentType[];
}) {
  const documentMode: DocumentMode = documentTypes?.length === 1 ? documentTypes[0] : "auto";
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(files: File[]) {
    if (!files.length) return;
    if (files.length > MAX_BATCH_FILES) { setError(`한 번에 최대 ${MAX_BATCH_FILES}개 파일까지 선택할 수 있습니다.`); return; }
    for (const file of files) {
      if (!isSupported(file)) { setError(`${file.name}: PDF 또는 JPG·PNG·WebP 파일만 업로드할 수 있습니다.`); return; }
      if (file.size > MAX_FILE_BYTES) { setError(`${file.name}: 파일은 20MB 이하로 올려 주세요.`); return; }
    }

    setBusy(true);
    setError("");
    const rubricTexts: string[] = [];
    const guideTexts: string[] = [];
    const failures: string[] = [];
    let totalPages = 0;
    let uncertainCount = 0;
    let locallyStored = 0;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`${index + 1}/${files.length} · ${file.name} 기기에 저장 중...`);
        try {
          try { const meta = await saveCurrentProjectFile(file); if (meta) locallyStored += 1; }
          catch { failures.push(`${file.name}: 원본을 기기에 보관하지 못했지만 판독은 계속했습니다.`); }
          setStatus(`${index + 1}/${files.length} · ${file.name} ${file.size > DIRECT_UPLOAD_BYTES ? "용량을 줄인 뒤 " : ""}판독 중...`);
          const response = file.size > DIRECT_UPLOAD_BYTES
            ? await uploadCompressed(file, documentMode)
            : await uploadDirect(file, documentMode);
          const payload = await readApiResponse<RubricPayload>(response, "문서를 판독하지 못했습니다.");
          const text = payload.documentText ?? payload.rubricText;
          if (!response.ok || !text || !payload.documentType) throw new Error(payload.error || "문서를 판독하지 못했습니다.");
          if (payload.documentType === "rubric") rubricTexts.push(text); else guideTexts.push(text);
          totalPages += payload.pages ?? 1;
          uncertainCount += payload.uncertainText?.length ?? 0;
        } catch (caught) {
          failures.push(`${file.name}: ${caught instanceof Error ? caught.message : "문서를 판독하지 못했습니다."}`);
        }
      }
      if (rubricTexts.length) onExtracted(rubricTexts.join("\n\n"));
      if (guideTexts.length && onGuideExtracted) onGuideExtracted(guideTexts.join("\n\n"));
      const successCount = rubricTexts.length + guideTexts.length;
      setStatus(successCount ? [`${successCount}/${files.length}개 반영 완료`, locallyStored ? `원본 ${locallyStored}개 기기 저장` : "", totalPages ? `총 ${totalPages}페이지` : "", uncertainCount ? `확인 필요한 글자 ${uncertainCount}곳` : ""].filter(Boolean).join(" · ") : "");
      setError(failures.join("\n"));
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-black text-slate-900">과제 문서 추가 <span className="font-semibold text-slate-400">(선택)</span></p><p className="mt-1 text-xs font-semibold leading-5 text-slate-500">PDF·JPG·PNG·WebP를 여러 개 선택할 수 있습니다. 큰 파일은 기기에서 자동으로 용량을 줄여 판독합니다. 파일당 최대 20MB입니다.</p></div>
        <label className={`inline-flex min-h-11 shrink-0 items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white ${disabled || busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          {busy ? "변환 중..." : status ? "파일 더 추가" : "PDF / 사진 추가"}
          <input accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp" className="sr-only" disabled={disabled || busy} multiple onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void upload(files); }} type="file" />
        </label>
      </div>
      {status ? <p aria-live="polite" className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-violet-700">{status}</p> : null}
      {error ? <p role="alert" className="mt-3 whitespace-pre-line rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}

async function uploadDirect(file: File, documentType: DocumentMode) {
  const formData = new FormData(); formData.set("file", file); formData.set("documentType", documentType);
  return fetch("/api/assignment/extract-rubric", { method: "POST", body: formData });
}

async function uploadCompressed(file: File, documentType: DocumentMode) {
  const pageImages = isPdf(file) ? await renderPdf(file) : [await compressImage(file)];
  return fetch("/api/assignment/extract-rubric", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, documentType, pageImages }) });
}

async function renderPdf(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await task.promise;
  try {
    if (document.numPages < 1 || document.numPages > MAX_PAGES) throw new Error(`PDF는 ${MAX_PAGES}페이지 이하로 올려 주세요.`);
    const images: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.max(1, Math.min(2.5, RENDER_LONG_EDGE / Math.max(base.width, base.height))) });
      const canvas = window.document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false }); if (!context) throw new Error("PDF 페이지를 변환할 수 없습니다.");
      context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      images.push(canvas.toDataURL("image/jpeg", JPEG_QUALITY)); page.cleanup(); canvas.width = 1; canvas.height = 1;
    }
    return images;
  } finally { await task.destroy(); }
}

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, RENDER_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false }); if (!context) throw new Error("사진을 변환할 수 없습니다.");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally { bitmap.close(); }
}

function isPdf(file: File) { return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"); }
function isSupported(file: File) { const name = file.name.toLowerCase(); return isPdf(file) || SUPPORTED_IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/.test(name); }
