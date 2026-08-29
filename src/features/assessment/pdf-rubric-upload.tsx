"use client";

import { useState } from "react";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function PdfRubricUpload({
  disabled,
  onExtracted,
}: {
  disabled: boolean;
  onExtracted: (text: string) => void;
}) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setError("PDF는 4MB 이하로 올려 주세요.");
      return;
    }

    setStatus("PDF를 고화질로 변환하고 있습니다.");
    setError("");
    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/assignment/extract-rubric", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        rubricText?: string;
        pages?: number;
        uncertainText?: string[];
        error?: string;
      };
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
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-black text-slate-900">평가표 PDF</p><p className="mt-1 text-xs font-bold text-slate-500">최대 6페이지 · 4MB</p></div>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white">
          {status && !error ? "다시 선택" : "PDF 선택"}
          <input
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={disabled || status === "PDF를 고화질로 변환하고 있습니다."}
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
