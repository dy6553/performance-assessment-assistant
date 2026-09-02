"use client";

import { useEffect, useState } from "react";

import { buildLocalBackup, deleteAllLocalDataForOwner, restoreLocalBackup } from "@/lib/local-data/backup";
import { listAssignmentProjects } from "@/lib/local-data/assignments";
import { listLocalFiles } from "@/lib/local-data/files";
import { getConfiguredOwnerId } from "@/lib/local-data/owner";

export function LocalDataSettings({ mode }: { mode: "storage" | "backup" }) {
  const [usage, setUsage] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [projects, setProjects] = useState(0);
  const [files, setFiles] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId) return;
    try {
      const [estimate, isPersistent, assignmentRows, fileRows] = await Promise.all([
        navigator.storage?.estimate?.() ?? Promise.resolve({ usage: undefined, quota: undefined }),
        navigator.storage?.persisted?.() ?? Promise.resolve(null),
        listAssignmentProjects(ownerId),
        listLocalFiles(ownerId),
      ]);
      setUsage(estimate.usage ?? 0);
      setQuota(estimate.quota ?? 0);
      setPersistent(isPersistent);
      setProjects(assignmentRows.length);
      setFiles(fileRows.length);
    } catch {
      setMessage("기기 저장공간 상태를 확인하지 못했습니다.");
    }
  }

  async function requestPersistence() {
    if (!navigator.storage?.persist) {
      setMessage("이 브라우저는 영구 저장 요청을 지원하지 않습니다. IndexedDB는 계속 사용합니다.");
      return;
    }
    const granted = await navigator.storage.persist().catch(() => false);
    setPersistent(granted);
    setMessage(granted ? "이 기기에서 데이터가 자동 정리되지 않도록 영구 저장을 요청했습니다." : "브라우저가 영구 저장 요청을 허용하지 않았습니다.");
  }

  async function exportBackup() {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const blob = await buildLocalBackup(ownerId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `teston-backup-${localDateToken()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMessage("이 기기의 수행평가·AI 대화·캘린더·업로드 파일을 백업했습니다.");
    } catch {
      setMessage("로컬 데이터 백업을 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function importBackup(file: File | undefined) {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId || !file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await restoreLocalBackup(ownerId, file);
      setMessage("백업 데이터를 현재 로그인 계정의 로컬 저장공간에 복원했습니다. 새로고침하면 반영됩니다.");
      await refresh();
    } catch {
      setMessage("수행평가 도우미에서 만든 올바른 로컬 데이터 백업 파일인지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteLocalData() {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId || busy) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setMessage("한 번 더 누르면 현재 로그인 계정의 이 기기 수행평가 데이터와 업로드 원본을 삭제합니다. 공통 개인화 설정은 삭제하지 않습니다.");
      return;
    }
    setBusy(true);
    try {
      await deleteAllLocalDataForOwner(ownerId);
      for (const key of [
        "assessment-wizard-draft-v1",
        "assessment-wizard-analysis-v1",
        "assessment-wizard-generated-draft-v1",
        "assessment-wizard-verification-v1",
        "assessment-final-initialized-v1",
        "assessment-ai-chat-v1",
      ]) window.sessionStorage.removeItem(key);
      setProjects(0);
      setFiles(0);
      setConfirmDelete(false);
      setMessage("현재 계정의 이 기기 개인 작업 데이터를 삭제했습니다.");
      await refresh();
    } catch {
      setMessage("로컬 데이터를 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function resetSharedPersonalization() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/personalization/shared", { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error("reset failed");
      setMessage("시험온 계정의 공통 개인화 설정을 초기화했습니다. 이 기기의 수행평가 데이터는 유지됩니다.");
    } catch {
      setMessage("공통 개인화 설정을 초기화하지 못했습니다. 시험온 계정과 동일한 이메일 계정인지 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "backup") {
    return (
      <div className="space-y-4">
        <Panel title="이 기기의 개인 데이터 백업" description="수행평가 프로젝트, 초안·완성본, AI 대화, 캘린더와 로컬 업로드 원본을 JSON 백업 파일로 내보냅니다. 다른 계정 데이터는 포함하지 않습니다.">
          <button className={primaryButton} disabled={busy} onClick={() => void exportBackup()} type="button">백업 파일 내보내기</button>
        </Panel>
        <Panel title="백업 복원" description="이 앱에서 만든 백업 파일을 현재 로그인 계정의 로컬 저장공간으로 복원합니다.">
          <label className={`${secondaryButton} cursor-pointer`}>
            백업 파일 불러오기
            <input accept="application/json,.json" className="sr-only" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importBackup(file); }} type="file" />
          </label>
        </Panel>
        <Message value={message} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Panel title="개인 데이터 저장" description="수행평가 작성 내용과 AI 작업 기록은 기본적으로 이 기기의 IndexedDB에 저장됩니다. 업로드 원본은 OPFS를 우선 사용하고 지원하지 않는 환경에서는 IndexedDB Blob으로 보관합니다.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="로컬 프로젝트" value={`${projects}개`} />
          <Stat label="로컬 업로드 파일" value={`${files}개`} />
          <Stat label="사용 중" value={usage === null ? "확인 불가" : formatBytes(usage)} />
          <Stat label="브라우저 할당량" value={quota === null ? "확인 불가" : formatBytes(quota)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={secondaryButton} onClick={() => void refresh()} type="button">저장공간 새로고침</button>
          <button className={secondaryButton} onClick={() => void requestPersistence()} type="button">{persistent ? "영구 저장 사용 중" : "영구 저장 요청"}</button>
        </div>
      </Panel>
      <Panel title="공통 개인화 설정 초기화" description="학교급·학년·교육과정·AI 설명 선호만 초기화합니다. 이 기기의 수행평가 프로젝트와 파일은 건드리지 않습니다.">
        <button className={secondaryButton} disabled={busy} onClick={() => void resetSharedPersonalization()} type="button">공통 개인화만 초기화</button>
      </Panel>
      <Panel title="이 기기의 수행평가 데이터 삭제" description="현재 로그인 계정에 속한 로컬 프로젝트, AI 대화, 캘린더와 업로드 원본을 삭제합니다. 다른 계정의 로컬 데이터와 시험온 공통 개인화는 유지합니다.">
        <button className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-700 disabled:opacity-50" disabled={busy} onClick={() => void deleteLocalData()} type="button">{confirmDelete ? "정말 삭제" : "이 기기의 개인 데이터 삭제"}</button>
      </Panel>
      <Message value={message} />
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-950">{title}</h2><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p><div className="mt-4">{children}</div></section>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black text-slate-400">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>; }
function Message({ value }: { value: string }) { return value ? <p className="rounded-2xl bg-violet-50 p-3 text-sm font-bold leading-6 text-violet-800">{value}</p> : null; }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`; if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${(bytes / 1024 ** 3).toFixed(1)} GB`; }
function localDateToken() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
const primaryButton = "min-h-11 rounded-xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50";
