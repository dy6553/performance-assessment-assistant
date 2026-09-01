"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteAssignmentDataAction } from "./actions";

export function AssignmentDataDeleteButton({
  assignmentId,
  label,
}: {
  assignmentId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function remove() {
    if (!window.confirm(`“${label}” 수행평가와 연결 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    startTransition(async () => {
      setMessage("");
      const data = new FormData();
      data.set("assignmentId", assignmentId);
      data.set("confirm", "DELETE");
      const result = await deleteAssignmentDataAction(data);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="shrink-0">
      <button
        className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-extrabold text-rose-700 disabled:opacity-50"
        disabled={busy}
        onClick={remove}
        type="button"
      >
        {busy ? "삭제 중…" : "삭제"}
      </button>
      {message ? <p className="mt-2 max-w-48 text-xs font-bold text-rose-700">{message}</p> : null}
    </div>
  );
}
