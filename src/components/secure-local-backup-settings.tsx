"use client";

import { useState } from "react";

import { buildLocalBackup, restoreLocalBackup } from "@/lib/local-data/backup";
import { getConfiguredOwnerId } from "@/lib/local-data/owner";
import {
  decryptSecureBackup,
  encryptSecureBackup,
  isSecureBackup,
  sha256Hex,
} from "@/lib/local-data/secure-backup";

const SECURE_FORMAT = "assessment-helper-full-device-backup";
const MAX_PLAIN_BACKUP_BYTES = 250 * 1024 * 1024;
const MAX_SECURE_FILE_BYTES = MAX_PLAIN_BACKUP_BYTES + 1024 * 1024;
const OWNER_PREFIX = "owner-sha256:";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function SecureLocalBackupSettings() {
  const [encrypted, setEncrypted] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function exportBackup() {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId || busy) {
      if (!ownerId) setMessage("로그인한 뒤 현재 계정의 기기 데이터를 백업할 수 있습니다.");
      return;
    }
    if (encrypted && password.length < 10) {
      setMessage("암호화 백업 암호는 10자 이상으로 설정해 주세요.");
      return;
    }
    if (encrypted && password !== confirmPassword) {
      setMessage("백업 암호와 확인 입력이 서로 다릅니다.");
      return;
    }
    if (!encrypted && !window.confirm("암호화하지 않은 JSON 백업에는 수행평가 본문과 업로드 파일이 그대로 들어갑니다. 평문으로 내보낼까요?")) {
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const plainBlob = await buildLocalBackup(ownerId);
      if (plainBlob.size > MAX_PLAIN_BACKUP_BYTES) throw new Error("BACKUP_TOO_LARGE");

      if (!encrypted) {
        downloadBlob(plainBlob, `assessment-helper-device-backup-${localDateToken()}.json`);
        setMessage("호환용 평문 JSON 백업을 내보냈습니다. 개인정보 보호를 위해 안전한 위치에 보관해 주세요.");
        return;
      }

      const plainBytes = new Uint8Array(await plainBlob.arrayBuffer());
      const ownerHash = await sha256Hex(ownerId);
      const prefix = encoder.encode(`${OWNER_PREFIX}${ownerHash}\n`);
      const protectedPayload = new Uint8Array(prefix.byteLength + plainBytes.byteLength);
      protectedPayload.set(prefix, 0);
      protectedPayload.set(plainBytes, prefix.byteLength);

      const secureBlob = await encryptSecureBackup(protectedPayload.buffer, password, {
        app: "수행평가 도우미",
        format: SECURE_FORMAT,
      });
      downloadBlob(secureBlob, `assessment-helper-secure-backup-${localDateToken()}.assessment-backup`);
      setPassword("");
      setConfirmPassword("");
      setMessage("수행평가 프로젝트·초안·완성본·AI 대화·캘린더·업로드 원본을 암호화 백업으로 내보냈습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "BACKUP_TOO_LARGE"
          ? "백업 데이터가 250MB를 넘습니다. 큰 업로드 파일을 정리한 뒤 다시 시도해 주세요."
          : "기기 데이터 백업 파일을 만들지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file: File | undefined) {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId || !file || busy) {
      if (!ownerId) setMessage("로그인한 뒤 백업을 복원할 수 있습니다.");
      return;
    }
    if (file.size > MAX_SECURE_FILE_BYTES) {
      setMessage("백업 파일이 너무 큽니다. 251MB 이하 파일인지 확인해 주세요.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (await isSecureBackup(file)) {
        if (password.length < 10) throw new Error("BACKUP_PASSWORD_REQUIRED");
        const plaintext = new Uint8Array(await decryptSecureBackup(file, password, {
          app: "수행평가 도우미",
          format: SECURE_FORMAT,
        }));
        const newlineIndex = plaintext.indexOf(10);
        if (newlineIndex <= 0) throw new Error("INVALID_BACKUP");
        const prefix = decoder.decode(plaintext.subarray(0, newlineIndex));
        if (!prefix.startsWith(OWNER_PREFIX)) throw new Error("INVALID_BACKUP");
        const expectedOwnerHash = await sha256Hex(ownerId);
        if (prefix.slice(OWNER_PREFIX.length) !== expectedOwnerHash) {
          throw new Error("BACKUP_ACCOUNT_MISMATCH");
        }
        const backupBytes = plaintext.slice(newlineIndex + 1);
        if (backupBytes.byteLength > MAX_PLAIN_BACKUP_BYTES) throw new Error("BACKUP_TOO_LARGE");
        await restoreLocalBackup(
          ownerId,
          new File([backupBytes], "assessment-helper-restored.json", { type: "application/json" }),
        );
        setPassword("");
        setConfirmPassword("");
        setMessage("암호화 백업을 현재 계정의 로컬 저장공간에 복원했습니다. 기존 자료와 병합됩니다.");
      } else {
        await restoreLocalBackup(ownerId, file);
        setMessage("이전 형식의 평문 JSON 백업을 복원했습니다. 다음 백업부터는 암호화 백업을 권장합니다.");
      }
    } catch (error) {
      if (error instanceof Error && error.message === "BACKUP_PASSWORD_REQUIRED") {
        setMessage("암호화 백업을 만들 때 사용한 10자 이상의 암호를 입력해 주세요.");
      } else if (error instanceof Error && error.message === "BACKUP_ACCOUNT_MISMATCH") {
        setMessage("이 암호화 백업은 현재 로그인한 수행도우미 계정에서 만든 백업이 아닙니다. 원래 계정으로 로그인해 주세요.");
      } else if (error instanceof Error && error.message === "BACKUP_PASSWORD_OR_INTEGRITY_FAILED") {
        setMessage("백업 암호가 다르거나 파일이 손상되었습니다.");
      } else if (error instanceof Error && error.message === "BACKUP_TOO_LARGE") {
        setMessage("백업 데이터가 허용 크기를 초과했습니다.");
      } else {
        setMessage("수행평가 도우미에서 만든 올바른 백업 파일인지 확인해 주세요.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 space-y-4">
      <section className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
        <p className="text-sm font-extrabold text-emerald-700">기기 데이터 보호</p>
        <h2 className="mt-1 text-xl font-black text-slate-950">수행평가 전체 백업</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          수행평가 프로젝트, 초안·완성본, AI 대화, 캘린더와 업로드 원본을 한 파일로 내보냅니다. 암호화가 기본이며 암호는 서버·Supabase·기기에 저장하지 않습니다.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-white p-4">
          <input
            checked={encrypted}
            className="mt-1 size-4 accent-emerald-700"
            disabled={busy}
            onChange={(event) => setEncrypted(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block font-black text-slate-900">AES-256-GCM 암호화 사용 (권장)</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">해제하면 이전 호환용 평문 JSON으로 내보냅니다.</span>
          </span>
        </label>

        {encrypted ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">
              백업 암호
              <input
                autoComplete="new-password"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-emerald-500"
                disabled={busy}
                minLength={10}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="10자 이상"
                type="password"
                value={password}
              />
            </label>
            <label className="text-sm font-bold text-slate-700">
              백업 암호 확인
              <input
                autoComplete="new-password"
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-emerald-500"
                disabled={busy}
                minLength={10}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="같은 암호 다시 입력"
                type="password"
                value={confirmPassword}
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void exportBackup()}
            type="button"
          >
            {busy ? "처리 중" : encrypted ? "암호화 백업 내보내기" : "평문 JSON 내보내기"}
          </button>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 text-sm font-black text-emerald-800">
            백업 파일 복원
            <input
              accept=".assessment-backup,.json,application/octet-stream,application/json"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                void importBackup(file);
              }}
              type="file"
            />
          </label>
        </div>

        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
          암호화 백업의 암호를 잊으면 복구할 수 없습니다. 암호화 백업은 같은 수행도우미 계정에서만 복원할 수 있으며, 복원 시 기존 프로젝트를 전부 지우지 않고 병합합니다.
        </p>
        {message ? <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-bold leading-6 text-slate-700" role="status">{message}</p> : null}
      </section>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function localDateToken() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
