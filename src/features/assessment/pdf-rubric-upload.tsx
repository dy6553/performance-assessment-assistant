"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/http/client-response";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PAGES = 6;
const CLIENT_RENDER_LONG_EDGE = 1_400;
const CLIENT_JPEG_QUALITY = 0.68;

type DocumentType = "rubric" | "guide";

type RubricPayload = {
  documentType?: DocumentType;
  documentText?: string;
  rubricText?: string;
  pages?: number;
  uncertainText?: string[];
  error?: string;
};

const documentOptions: Array<{
  value: DocumentType;
  label: string;
  description: string;
}> = [
  {
    value: "rubric",
    label: "평가기준표",
    description: "배점·평가요소·루브릭을 읽어 평가 기준 칸에 넣습니다.",
  },
  {
    value: "guide",
    label: "수행평가 안내서",
    description: "과제 설명·제출 방법·필수 조건을 읽어 과제 설명 칸에 넣습니다.",
  },
];

export function PdfRubricUpload({
  disabled,
  onExtracted,
  documentTypes,
}: {
  disabled: boolean;
  onExtracted: (text: string) => void;
  documentTypes?: DocumentType[];
}) {
  const availableOptions = documentOptions.filter(
    (option) => !documentTypes?.length || documentTypes.includes(option.value),
  );
  const safeOptions = availableOptions.length ? availableOptions : [documentOptions[0]];
  const [documentType, setDocumentType] = useState<DocumentType>(safeOptions[0].value);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedOption = safeOptions.find((option) => option.value === documentType) ?? safeOptions[0];
  const singleType = safeOptions.length === 1;

  async function upload(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setError("PDF는 20MB 이하로 올려 주세요.");
      return;
    }

    setBusy(true);
    setError("");
    setStatus(
      file.size > DIRECT_UPLOAD_BYTES
        ? `${selectedOption.label} PDF를 기기에서 압축한 뒤 판독하고 있습니다.`
        : `${selectedOption.label} PDF를 고화질로 판독하고 있습니다.`,
    );

    try {
      const response =
        file.size > DIRECT_UPLOAD_BYTES
          ? await uploadCompressedPdf(file, documentType)
          : await uploadDirectPdf(file, documentType);
      const payload = await readApiResponse<RubricPayload>(response, "PDF를 판독하지 못했습니다.");
      const documentText = payload.documentText ?? payload.rubricText;
      if (!response.ok || !documentText) {
        throw new Error(payload.error || "PDF를 판독하지 못했습니다.");
      }

      if (documentType === "guide") {
        if (!applyTeacherInstruction(documentText)) {
          throw new Error("수행평가 안내서 내용을 과제 설명 칸에 반영하지 못했습니다. 다시 시도해 주세요.");
        }
      } else {
        onExtracted(documentText);
      }

      setStatus(
        payload.uncertainText?.length
          ? `${selectedOption.label} ${payload.pages ?? 0}페이지 완료 · 불확실한 글자 ${payload.uncertainText.length}곳`
          : `${selectedOption.label} ${payload.pages ?? 0}페이지 판독 완료`,
      );
    } catch (caught) {
      setStatus("");
      setError(caught instanceof Error ? caught.message : "PDF를 판독하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function selectDocumentType(nextType: DocumentType) {
    if (busy) return;
    setDocumentType(nextType);
    setStatus("");
    setError("");
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-4">
      <div>
        <p className="font-black text-slate-900">{singleType ? `${selectedOption.label} PDF` : "수행평가 문서 PDF"}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {singleType ? "PDF를 선택하면 AI가 평가항목과 배점을 판독합니다." : "먼저 파일 종류를 선택하세요."} · 최대 6페이지 · 20MB
        </p>
      </div>

      {!singleType ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="업로드할 파일 종류">
          {safeOptions.map((option) => {
            const active = documentType === option.value;
            return (
              <button
                aria-pressed={active}
                className={`rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-violet-500 bg-violet-100 text-violet-950 shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50/60"
                }`}
                disabled={disabled || busy}
                key={option.value}
                onClick={() => selectDocumentType(option.value)}
                type="button"
              >
                <span className="block text-sm font-black">{option.label}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{option.description}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/70 p-3">
        <div>
          <p className="text-xs font-black text-violet-700">선택됨 · {selectedOption.label}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">PDF를 선택하면 AI가 선택한 문서 종류에 맞춰 판독합니다.</p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white">
          {status && !error ? "다시 선택" : `${selectedOption.label} PDF 선택`}
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

async function uploadDirectPdf(file: File, documentType: DocumentType) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("documentType", documentType);
  return fetch("/api/assignment/extract-rubric", {
    method: "POST",
    body: formData,
  });
}

async function uploadCompressedPdf(file: File, documentType: DocumentType) {
  const pageImages = await renderPdfForUpload(file);
  return fetch("/api/assignment/extract-rubric", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: file.name, pageImages, documentType }),
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
      throw new Error(`PDF는 ${MAX_PAGES}페이지 이하로 올려 주세요.`);
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
