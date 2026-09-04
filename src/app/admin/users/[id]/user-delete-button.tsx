"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { deleteUserAccountAction } from "@/app/admin/actions";

export function UserDeleteButton({ userId, label }: { userId: string; label: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function remove() {
    if (!window.confirm(`${label} 계정을 영구 삭제할까요? 수행평가와 연결 데이터도 함께 삭제되며 되돌릴 수 없습니다.`)) return;

    startTransition(async () => {
      setMessage("");
      const data = new FormData();
      data.set("userId", userId);
      data.set("confirmation", "DELETE");
      try {
        const result = await deleteUserAccountAction(data);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.replace("/admin/users");
        router.refresh();
      } catch {
        setMessage("계정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  return (
    <div className="mt-5">
      <button
        className="min-h-12 w-full rounded-2xl bg-rose-600 px-5 font-black text-white disabled:opacity-50"
        disabled={busy}
        onClick={remove}
        type="button"
      >
        {busy ? "삭제 중…" : "계정 영구 삭제"}
      </button>
      {message ? <p className="mt-2 text-sm font-bold text-rose-700">{message}</p> : null}
    </div>
  );
}
