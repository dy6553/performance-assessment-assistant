"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateUserStatusAction } from "../actions";
import { revokeDeveloperAccountAction } from "./actions";

export function DeveloperRemoveButton({ userId, developerId }: { userId: string; developerId: string }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function remove() {
    if (!window.confirm(`${developerId} 계정을 삭제할까요? 삭제하면 로그인할 수 없습니다.`)) return;
    startTransition(async () => {
      setMessage("");
      const revokeData = new FormData();
      revokeData.set("userId", userId);
      revokeData.set("developerId", developerId);
      await revokeDeveloperAccountAction(revokeData);

      const statusData = new FormData();
      statusData.set("userId", userId);
      statusData.set("status", "SUSPENDED");
      await updateUserStatusAction(statusData);
      router.refresh();
    });
  }

  return (
    <div>
      <button
        className="min-h-11 rounded-xl bg-rose-50 px-4 text-sm font-extrabold text-rose-700 disabled:opacity-50"
        disabled={busy}
        onClick={remove}
        type="button"
      >
        {busy ? "삭제 중…" : "삭제"}
      </button>
      {message ? <p className="mt-2 text-xs font-bold text-rose-700">{message}</p> : null}
    </div>
  );
}
