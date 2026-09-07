"use client";

import { useState } from "react";

import { readApiResponse } from "@/lib/http/client-response";
import { saveCurrentProjectFile } from "@/lib/local-data/files";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_BATCH_FILES = 10;
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
    if (files.length > MAX_BATCH_FILES) {
      setError(`한 번에 최대 ${MAX_BATCH_FILES}개 파일까지 선택할 수 있습니다.`);
      return;
    }
    for (const file of files) {
      if (!isSupported(file)) {
        setError(`${file.name}: PDF 또는 JPG·PNG·WebP 파일만 업로드할 수 있습니다.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`${file.name}: 백엔드 변환을 위해 파일당 4MB 이하로 올려 주세요.`);
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
    let locallyStored = 0;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`${index + 1}/${files.length} · ${file.name} 기기에 저장한 뒤 백엔드에서 변환 중...`);
        try {
          try {
            const meta = await saveCurrentProjectFile(file);
            if (meta) locallyStored += 1;
          } catch {
            failures.push(`${file.name}: 원본을 기기에 보관하지 못했지만 판독은 계속했습니다.`);
          }
          const formData = new FormData();
          formData.set("file", file);
          formData.set("documentType", documentMode);
          const response = await fetch("/api/assignment/extract-rubric", { method: "POST", body: formData });
          const payload = await readApiResponse<RubricPayload>(response, "문서를 판독하지 못했습니다.");
          const text = payload.documentText ?? payload.rubricText;
          if (!response.ok || !text || !payload.documentType) throw new Error(payload.error || "문서를 판독하지 못했습니다.");
          if (payload.documentType === "rubric") rubricTexts.push(text);
          else guideTexts.push(text);
          totalPages += payload.pages ?? 1;
          uncertainCount += payload.uncertainText?.length ?? 0;
        } catch (caught) {
          failures.push(`${file.name}: ${caught instanceof Error ? caught.message : "문서를 판독하지 못했습니다."}`);
        }
      }

      if (rubricTexts.length) onExtracted(rubricTexts.join("\n\n"));
      if (guideTexts.length && onGuideExtracted) onGuideExtracted(guideTexts.join("\n\n"));
      const successCount = rubricTexts.length + guideTexts.length;
      setStatus(successCount ? [
        `${successCount}/${files.length}개 반영 완료`,
        locallyStored ? `원본 ${locallyStored}개 기기 저장` : "",
        totalPages ? `총 ${totalPages}페이지` : "",
        uncertainCount ? `확인 필요한 글자 ${uncertainCount}곳` : "",
      ].filter(Boolean).join(" · ") : "");
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
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">PDF·JPG·PNG·WebP를 여러 개 선택할 수 있습니다. 원본은 기기에 먼저 저장하고, 변환과 판독은 백엔드에서 처리합니다. 파일당 최대 4MB입니다.</p>
        </div>
        <label className={`inline-flex min-h-11 shrink-0 items-center rounded-xl bg-violet-600 px-4 text-sm font-black text-white ${disabled || busy ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
          {busy ? "백엔드 변환 중..." : status ? "파일 더 추가" : "PDF / 사진 추가"}
          <input accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp" className="sr-only" disabled={disabled || busy} multiple
            onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void upload(files); }} type="file" />
        </label>
      </div>
      {status ? <p aria-live="polite" className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs font-bold text-violet-700">{status}</p> : null}
      {error ? <p role="alert" className="mt-3 whitespace-pre-line rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p> : null}
    </div>
  );
}

function isSupported(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf") || SUPPORTED_IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/.test(name);
}
