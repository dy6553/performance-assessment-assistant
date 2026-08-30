"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/http/client-response";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 6;
const CLIENT_RENDER_LONG_EDGE = 1_400;
const CLIENT_JPEG_QUALITY = 0.68;

type RubricPayload = {
  rubricText?: string;
  pages?: number;
  uncertainText?: string[];
  error?: string;
};

export function PdfRubricUpload({
  disabled,
  onExtracted,
}: {
  disabled: boolean;
  onExtracted: (text: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setError("PDF는 20MB 이하로 올려 주세요.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus(
      file.size > DIRECT_UPLOAD_BYTES
        ? "큰 PDF를 기기에서 압축한 뒤 판독하고 있습니다."
        : "PDF를 고화질로 변환하고 있습니다.",
    );

    try {
      const response =
        file.size > DIRECT_UPLOAD_BYTES ? await uploadCompressedPdf(file) : await uploadDirectPdf(file);
      const payload = await readApiResponse<RubricPayload>(response, "평가표를 판독하지 못했습니다.");
      if (!response.ok || !payload.rubricText) {
        throw new Error(payload.error || "평가표를 판독하지 못했습니다.");
      }

      onExtracted(payload.rubricText);
      setStatus(
        payload.uncertainText?.length
          ? `${payload.pages ?? 0}페이지 완료 · 불확실한 글자 ${payload.uncertainText.length}곳`
          : `${payload.pages ?? 0}페이지 판독 완료`,
      );
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "평가표를 판독하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">평가표 PDF</p>
          <p className="mt-1 text-xs font-bold text-slate-500">최대 6페이지 · 20MB</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white">
          {status && !error ? "다시 선택" : "PDF 선택"}
          <input
            accept="application/pdf,.pdf"
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
      {status ? <p aria-live="polite" className="mt-3 text-sm font-bold text-violet-700">{status}</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}

async function uploadDirectPdf(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return fetch("/api/assignment/extract-rubric", {
    method: "POST",
    body: formData,
  });
}

async function uploadCompressedPdf(file: File) {
  const pageImages = await renderPdfForUpload(file);
  return fetch("/api/assignment/extract-rubric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, pageImages }),
  });
}

async function renderPdfForUpload(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdfDocument = await loadingTask.promise;

  try {
    if (pdfDocument.numPages < 1) throw new Error("PDF에 페이지가 없습니다.");
    if (pdfDocument.numPages > MAX_PAGES) {
      throw new Error(`평가표 PDF는 ${MAX_PAGES}페이지 이하로 올려 주세요.`);
    }

    const pageImages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const page = await pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(
        1,
        Math.min(2.5, CLIENT_RENDER_LONG_EDGE / Math.max(baseViewport.width, baseViewport.height)),
      );
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
