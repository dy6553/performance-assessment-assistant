"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/http/client-response";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
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

  async function upload(file: File) {
    const pdf = isPdf(file);
    const image = isSupportedImage(file);

    if (!pdf && !image) {
      setError("PDF 또는 JPG·PNG·WebP 사진만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("파일은 20MB 이하로 올려 주세요.");
      return;
    }

    setBusy(true);
    setError("");
    if (pdf) {
      setStatus(file.size > DIRECT_UPLOAD_BYTES ? "PDF를 압축한 뒤 AI가 문서 종류와 내용을 확인하고 있습니다." : "AI가 PDF 종류와 내용을 확인하고 있습니다.");
    } else {
      setStatus("사진을 선명하게 변환한 뒤 AI가 문서 종류와 내용을 확인하고 있습니다.");
    }

    try {
      const response = pdf
        ? file.size > DIRECT_UPLOAD_BYTES
          ? await uploadCompressedPdf(file, documentMode)
          : await uploadDirectPdf(file, documentMode)
        : await uploadPhoto(file, documentMode);
      const payload = await readApiResponse<RubricPayload>(response, "문서를 판독하지 못했습니다.");
      const documentText = payload.documentText ?? payload.rubricText;
      if (!response.ok || !documentText || !payload.documentType) {
        throw new Error(payload.error || "문서를 판독하지 못했습니다.");
      }

      if (payload.documentType === "guide") {
        if (onGuideExtracted) {
          onGuideExtracted(documentText);
        } else if (!applyTeacherInstruction(documentText)) {
          throw new Error("안내문 내용을 과제 설명 칸에 반영하지 못했습니다. 다시 시도해 주세요.");
        }
      } else {
        onExtracted(documentText);
      }

      const label = payload.documentType === "rubric" ? "평가기준표" : "수행평가 안내문";
      setStatus(
        payload.uncertainText?.length
          ? `${label}로 판별 · ${payload.pages ?? 0}페이지 완료 · 확인 필요한 글자 ${payload.uncertainText.length}곳`
          : `${label}로 판별 · ${payload.pages ?? 0}페이지 반영 완료`,
      );
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "문서를 판독하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black text-slate-900">과제 문서 추가 <span className="font-semibold text-slate-400">(선택)</span></p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">평가기준표나 수행평가 안내문을 PDF 또는 사진으로 올리면 AI가 종류를 판별해 알맞은 칸에 반영합니다. PDF 최대 6페이지 · 파일당 20MB</p>
        </div>
        <label className={`inline-flex min-h-11 shrink-0 items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white ${disabled || busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          {busy ? "판독 중..." : status ? "다른 문서 추가" : "PDF / 사진 추가"}
          <input
            accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void upload(file);
            }}
            type="file"
          />
        </label>
      </div>
      {status ? <p aria-live="polite" className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-violet-700">{status}</p> : null}
      {error ? <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
    </div>
  );
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
