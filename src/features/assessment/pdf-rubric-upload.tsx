"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/http/client-response";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_FILES = 10;
const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 6;
const CLIENT_RENDER_LONG_EDGE = 1_400;
const CLIENT_JPEG_QUALITY = 0.68;
const PHOTO_RENDER_LONG_EDGE = 1_800;
const PHOTO_JPEG_QUALITY = 0.82;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type DocumentType = "rubric" | "guide";
type DocumentMode = DocumentType | "auto";

type RubricPayload = {
  documentType?: DocumentType;
  documentText?: string;
  rubricText?: string;
  pages?: number;
  uncertainText?: string[];
  error?: string;
};

type ProcessedDocument = {
  documentType: DocumentType;
  documentText: string;
  pages: number;
  uncertainCount: number;
};

export function PdfRubricUpload({
  disabled,
  onExtracted,
  onGuideExtracted,
  documentTypes,
}: {
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
    if (files.length < 1) return;
    if (files.length > MAX_BATCH_FILES) {
      setError(`한 번에 최대 ${MAX_BATCH_FILES}개 파일까지 선택할 수 있습니다.`);
      return;
    }

    for (const file of files) {
      if (!isPdf(file) && !isSupportedImage(file)) {
        setError(`${file.name}: PDF 또는 JPG·PNG·WebP 사진만 업로드할 수 있습니다.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name}: 파일은 20MB 이하로 올려 주세요.`);
        return;
      }
    }

    setBusy(true);
    setError("");

    const rubricTexts: string[] = [];
    const guideTexts: string[] = [];
    const failures: string[] = [];
    let totalPages = 0;
    let uncertainCount = 0;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`${index + 1}/${files.length} · ${file.name} 판독 중...`);

        try {
          const result = await processFile(file, documentMode);
          totalPages += result.pages;
          uncertainCount += result.uncertainCount;
          if (result.documentType === "rubric") rubricTexts.push(result.documentText);
          else guideTexts.push(result.documentText);
        } catch (caught) {
          failures.push(`${file.name}: ${caught instanceof Error ? caught.message : "문서를 판독하지 못했습니다."}`);
        }
      }

      if (rubricTexts.length) onExtracted(rubricTexts.join("\n\n"));
      if (guideTexts.length) {
        const guideText = guideTexts.join("\n\n");
        if (onGuideExtracted) {
          onGuideExtracted(guideText);
        } else if (!applyTeacherInstruction(guideText)) {
          failures.push("안내문 내용을 과제 설명 칸에 반영하지 못했습니다.");
        }
      }

      const successCount = rubricTexts.length + guideTexts.length;
      if (successCount > 0) {
        const parts = [
          `${successCount}/${files.length}개 반영 완료`,
          rubricTexts.length ? `평가기준표 ${rubricTexts.length}개` : "",
          guideTexts.length ? `안내문 ${guideTexts.length}개` : "",
          totalPages ? `총 ${totalPages}페이지` : "",
          uncertainCount ? `확인 필요한 글자 ${uncertainCount}곳` : "",
        ].filter(Boolean);
        setStatus(parts.join(" · "));
      } else {
        setStatus("");
      }

      setError(failures.join("\n"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">과제 문서 추가 <span className="font-semibold text-slate-400">(선택)</span></p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">평가기준표나 수행평가 안내문을 PDF 또는 사진으로 한 번에 여러 개 올릴 수 있습니다. AI가 각 파일의 종류를 판별해 알맞은 칸에 합쳐 반영합니다. 한 번에 최대 10개 · PDF 각 최대 6페이지 · 파일당 20MB</p>
        </div>
        <label className={`inline-flex min-h-11 shrink-0 items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white ${disabled || busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          {busy ? "여러 문서 판독 중..." : status ? "파일 더 추가" : "PDF / 사진 여러 개 추가"}
          <input
            accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
            className="sr-only"
            disabled={disabled || busy}
            multiple
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = "";
              if (files.length) void upload(files);
            }}
            type="file"
          />
        </label>
      </div>
      {status ? <p aria-live="polite" className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-violet-700">{status}</p> : null}
      {error ? <p role="alert" className="mt-3 whitespace-pre-line rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}

async function processFile(file: File, documentType: DocumentMode): Promise<ProcessedDocument> {
  const pdf = isPdf(file);
  const response = pdf
    ? file.size > DIRECT_UPLOAD_BYTES
      ? await uploadCompressedPdf(file, documentType)
      : await uploadDirectPdf(file, documentType)
    : await uploadPhoto(file, documentType);
  const payload = await readApiResponse<RubricPayload>(response, "문서를 판독하지 못했습니다.");
  const documentText = payload.documentText ?? payload.rubricText;
  if (!response.ok || !documentText || !payload.documentType) {
    throw new Error(payload.error || "문서를 판독하지 못했습니다.");
  }
  return {
    documentType: payload.documentType,
    documentText,
    pages: payload.pages ?? (pdf ? 0 : 1),
    uncertainCount: payload.uncertainText?.length ?? 0,
  };
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isSupportedImage(file: File) {
  const name = file.name.toLowerCase();
  return SUPPORTED_IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/.test(name);
}

async function uploadDirectPdf(file: File, documentType: DocumentMode) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("documentType", documentType);
  return fetch("/api/assignment/extract-rubric", { method: "POST", body: formData });
}

async function uploadCompressedPdf(file: File, documentType: DocumentMode) {
  const pageImages = await renderPdfForUpload(file);
  return uploadPageImages(file.name, pageImages, documentType);
}

async function uploadPhoto(file: File, documentType: DocumentMode) {
  const pageImage = await renderPhotoForUpload(file);
  return uploadPageImages(file.name, [pageImage], documentType);
}

async function uploadPageImages(fileName: string, pageImages: string[], documentType: DocumentMode) {
  return fetch("/api/assignment/extract-rubric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, pageImages, documentType }),
  });
}

async function renderPhotoForUpload(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error("사진 크기를 확인할 수 없습니다.");
    const scale = Math.min(1, PHOTO_RENDER_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = window.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("사진을 변환할 수 없습니다.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

async function renderPdfForUpload(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdfDocument = await loadingTask.promise;

  try {
    if (pdfDocument.numPages < 1) throw new Error("PDF에 페이지가 없습니다.");
    if (pdfDocument.numPages > MAX_PAGES) throw new Error(`PDF는 ${MAX_PAGES}페이지 이하로 올려 주세요.`);

    const pageImages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(1, Math.min(2.5, CLIENT_RENDER_LONG_EDGE / Math.max(baseViewport.width, baseViewport.height)));
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("PDF 페이지를 변환할 수 없습니다.");

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      pageImages.push(canvas.toDataURL("image/jpeg", CLIENT_JPEG_QUALITY));
      page.cleanup();
      canvas.width = 1;
      canvas.height = 1;
    }
    return pageImages;
  } finally {
    await loadingTask.destroy();
  }
}

function applyTeacherInstruction(text: string) {
  const textarea = Array.from(window.document.querySelectorAll("textarea")).find((element) =>
    element.placeholder.includes("수행평가 안내문"),
  );
  if (!textarea) return false;

  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
  if (!setter) return false;

  setter.call(textarea, text);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
