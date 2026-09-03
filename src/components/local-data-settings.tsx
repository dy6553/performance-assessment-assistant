"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  createFreshProjectId,
  deleteAssignmentProject,
  getCurrentProjectId,
  listAssignmentProjects,
  type AssignmentProject,
} from "@/lib/local-data/assignments";
import { buildLocalBackup, deleteAllLocalDataForOwner, restoreLocalBackup } from "@/lib/local-data/backup";
import { deleteProjectChat, listProjectChats, type LocalChatRecord } from "@/lib/local-data/chats";
import { deleteLocalFile, listLocalFiles, type LocalFileMeta } from "@/lib/local-data/files";
import { getConfiguredOwnerId } from "@/lib/local-data/owner";
import { SETTINGS_BACKUP_KEYS } from "@/lib/client-preferences";
import {
  readCalendarEvents,
  readCalendarNotified,
  writeCalendarEvents,
  writeCalendarNotified,
  type CalendarEvent,
} from "@/features/calendar/calendar-storage";

const SESSION_ITEMS = [
  ["assessment-wizard-draft-v1", "현재 수행평가 입력 내용"],
  ["assessment-wizard-analysis-v1", "현재 수행평가 분석 결과"],
  ["assessment-wizard-generated-draft-v1", "현재 생성 초안"],
  ["assessment-wizard-verification-v1", "현재 검증 결과"],
  ["assessment-final-initialized-v1", "완성본 초기화 상태"],
  ["assessment-ai-chat-v1", "현재 AI 도우미 임시 대화"],
] as const;

type PreferenceEntry = { key: string; value: string; bytes: number };
type SessionEntry = { key: string; label: string; value: string; bytes: number };

export function LocalDataSettings({ mode }: { mode: "storage" | "backup" }) {
  const [usage, setUsage] = useState<number | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [projectRows, setProjectRows] = useState<AssignmentProject[]>([]);
  const [chatRows, setChatRows] = useState<LocalChatRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [fileRows, setFileRows] = useState<LocalFileMeta[]>([]);
  const [preferenceRows, setPreferenceRows] = useState<PreferenceEntry[]>([]);
  const [sessionRows, setSessionRows] = useState<SessionEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId) {
      setMessage("로그인하면 현재 계정의 이 기기 저장 데이터를 관리할 수 있습니다.");
      return;
    }
    try {
      const [estimate, isPersistent, assignments, chats, files] = await Promise.all([
        navigator.storage?.estimate?.() ?? Promise.resolve({ usage: undefined, quota: undefined }),
        navigator.storage?.persisted?.() ?? Promise.resolve(null),
        listAssignmentProjects(ownerId),
        listProjectChats(ownerId),
        listLocalFiles(ownerId),
      ]);
      const events = readCalendarEvents();
      const preferences = SETTINGS_BACKUP_KEYS.flatMap((key) => {
        const value = localStorage.getItem(key);
        return value === null ? [] : [{ key, value, bytes: (key.length + value.length) * 2 }];
      });
      const sessions = SESSION_ITEMS.flatMap(([key, label]) => {
        const value = sessionStorage.getItem(key);
        return value === null ? [] : [{ key, label, value, bytes: (key.length + value.length) * 2 }];
      });
      const validIds = [
        ...assignments.map((row) => projectToken(row.id)),
        ...chats.map((row) => chatToken(row.key)),
        ...events.map((event) => calendarToken(event.id)),
        ...files.map((file) => fileToken(file.key)),
        ...preferences.map((entry) => preferenceToken(entry.key)),
        ...sessions.map((entry) => sessionToken(entry.key)),
      ];

      setUsage(estimate.usage ?? 0);
      setQuota(estimate.quota ?? 0);
      setPersistent(isPersistent);
      setProjectRows(assignments);
      setChatRows(chats);
      setCalendarEvents(events);
      setFileRows(files);
      setPreferenceRows(preferences);
      setSessionRows(sessions);
      setSelectedIds((current) => current.filter((id) => validIds.includes(id)));
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
      anchor.download = `assessment-helper-device-backup-${localDateToken()}.json`;
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

  function toggle(id: string) {
    setConfirmDelete(false);
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function selectIds(ids: string[]) {
    setConfirmDelete(false);
    setSelectedIds((current) => Array.from(new Set([...current, ...ids])));
  }

  function selectProjectBundle(projectId: string) {
    selectIds([
      projectToken(projectId),
      ...chatRows.filter((row) => row.assignmentId === projectId).map((row) => chatToken(row.key)),
      ...fileRows.filter((row) => row.assignmentId === projectId).map((row) => fileToken(row.key)),
    ]);
  }

  async function deleteSelectedData() {
    const ownerId = getConfiguredOwnerId();
    if (!ownerId || busy || selectedIds.length === 0) return;
    if (!window.confirm(`선택한 로컬 데이터 ${selectedIds.length}개를 삭제할까요? 체크하지 않은 데이터와 Supabase 서버 데이터는 유지됩니다.`)) return;

    setBusy(true);
    try {
      const selectedProjectIds = projectRows.filter((row) => selectedIds.includes(projectToken(row.id))).map((row) => row.id);
      const selectedChats = chatRows.filter((row) => selectedIds.includes(chatToken(row.key)));
      const selectedCalendarIds = calendarEvents.filter((event) => selectedIds.includes(calendarToken(event.id))).map((event) => event.id);
      const selectedFiles = fileRows.filter((file) => selectedIds.includes(fileToken(file.key)));
      const selectedPreferences = preferenceRows.filter((entry) => selectedIds.includes(preferenceToken(entry.key)));
      const selectedSessions = sessionRows.filter((entry) => selectedIds.includes(sessionToken(entry.key)));

      await Promise.all(selectedProjectIds.map((projectId) => deleteAssignmentProject(ownerId, projectId)));
      await Promise.all(selectedChats.map((row) => deleteProjectChat(ownerId, row.assignmentId)));
      await Promise.all(selectedFiles.map((file) => deleteLocalFile(file)));

      if (selectedCalendarIds.length) {
        const remaining = calendarEvents.filter((event) => !selectedCalendarIds.includes(event.id));
        writeCalendarEvents(remaining);
        const notified = readCalendarNotified();
        const nextNotified = Object.fromEntries(Object.entries(notified).filter(([key]) => !selectedCalendarIds.some((id) => key === id || key.startsWith(`${id}:`))));
        writeCalendarNotified(nextNotified);
      }

      selectedPreferences.forEach((entry) => localStorage.removeItem(entry.key));
      selectedSessions.forEach((entry) => sessionStorage.removeItem(entry.key));

      const currentProjectId = getCurrentProjectId(false);
      if (currentProjectId && selectedProjectIds.includes(currentProjectId)) createFreshProjectId();

      setSelectedIds([]);
      setConfirmDelete(false);
      setMessage(`선택한 로컬 데이터 ${selectedIds.length}개를 삭제했습니다. 삭제한 앱 설정은 다음 화면부터 기본값이 적용될 수 있습니다.`);
      await refresh();
    } catch {
      setMessage("선택한 로컬 데이터를 삭제하지 못했습니다.");
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
      for (const [key] of SESSION_ITEMS) window.sessionStorage.removeItem(key);
      setSelectedIds([]);
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
      <div className="mb-6 space-y-4">
        <Panel title="이 기기의 개인 작업 데이터 백업" description="현재 로그인 계정의 수행평가 프로젝트, 초안·완성본, AI 대화, 캘린더와 로컬 업로드 원본을 JSON 백업 파일로 내보냅니다. 다른 계정 데이터는 포함하지 않습니다.">
          <button className={primaryButton} disabled={busy} onClick={() => void exportBackup()} type="button">기기 데이터 백업 파일 내보내기</button>
        </Panel>
        <Panel title="기기 데이터 백업 복원" description="수행평가 도우미에서 만든 기기 데이터 백업 파일을 현재 로그인 계정의 로컬 저장공간으로 복원합니다.">
          <label className={`${secondaryButton} cursor-pointer`}>
            기기 데이터 백업 불러오기
            <input accept="application/json,.json" className="sr-only" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importBackup(file); }} type="file" />
          </label>
        </Panel>
        <Message value={message} />
      </div>
    );
  }

  const allIds = [
    ...projectRows.map((row) => projectToken(row.id)),
    ...chatRows.map((row) => chatToken(row.key)),
    ...calendarEvents.map((event) => calendarToken(event.id)),
    ...fileRows.map((file) => fileToken(file.key)),
    ...preferenceRows.map((entry) => preferenceToken(entry.key)),
    ...sessionRows.map((entry) => sessionToken(entry.key)),
  ];
  const projectTitle = (projectId: string) => projectRows.find((row) => row.id === projectId)?.title || projectRows.find((row) => row.id === projectId)?.subject || "연결 프로젝트";

  return (
    <div className="mb-6 space-y-4">
      <Panel title="현재 계정의 이 기기 저장 데이터" description="수행평가 작성 내용과 AI 작업 기록은 이 기기의 IndexedDB에 저장됩니다. 업로드 원본은 OPFS를 우선 사용하고 지원하지 않는 환경에서는 IndexedDB Blob으로 보관합니다.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="수행평가 프로젝트" value={`${projectRows.length}개`} />
          <Stat label="AI 대화" value={`${chatRows.length}개`} />
          <Stat label="캘린더 일정" value={`${calendarEvents.length}개`} />
          <Stat label="업로드 원본" value={`${fileRows.length}개`} />
          <Stat label="앱 설정" value={`${preferenceRows.length}개`} />
          <Stat label="임시 작업 상태" value={`${sessionRows.length}개`} />
          <Stat label="브라우저 사용량" value={usage === null ? "확인 불가" : formatBytes(usage)} />
          <Stat label="브라우저 할당량" value={quota === null ? "확인 불가" : formatBytes(quota)} />
          <Stat label="저장 보호" value={persistent === null ? "확인 불가" : persistent ? "영구 저장" : "브라우저 정책 적용"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={secondaryButton} onClick={() => void refresh()} type="button">저장공간 새로고침</button>
          <button className={secondaryButton} onClick={() => void requestPersistence()} type="button">{persistent ? "영구 저장 사용 중" : "영구 저장 요청"}</button>
        </div>
      </Panel>

      <Panel title="데이터를 골라서 삭제" description="프로젝트·AI 대화·일정·파일·앱 설정·임시 작업 상태를 각각 선택합니다. 체크하지 않은 항목은 삭제하지 않습니다.">
        <div className="mb-4 flex flex-wrap gap-2">
          <button className={smallButton} disabled={!allIds.length} onClick={() => setSelectedIds(allIds)} type="button">전체 선택</button>
          <button className={smallButton} disabled={!selectedIds.length} onClick={() => setSelectedIds([])} type="button">선택 해제</button>
        </div>

        <SelectionSection title="수행평가 프로젝트" count={projectRows.length} onSelectAll={() => selectIds(projectRows.map((row) => projectToken(row.id)))}>
          {projectRows.map((row) => (
            <CheckRow
              checked={selectedIds.includes(projectToken(row.id))}
              description={`${row.subject || "과목 미입력"} · ${stageLabel(row.stage)} · ${formatDate(row.updatedAt)}`}
              key={row.id}
              label={row.title || row.subject || "제목 없는 수행평가"}
              onChange={() => toggle(projectToken(row.id))}
              trailing={<button className={tinyButton} onClick={(event) => { event.preventDefault(); event.stopPropagation(); selectProjectBundle(row.id); }} type="button">연결 데이터 함께 선택</button>}
            />
          ))}
        </SelectionSection>

        <SelectionSection title="AI 대화" count={chatRows.length} onSelectAll={() => selectIds(chatRows.map((row) => chatToken(row.key)))}>
          {chatRows.map((row) => (
            <CheckRow checked={selectedIds.includes(chatToken(row.key))} description={`${row.messages.length}개 메시지 · ${formatDate(row.updatedAt)}`} key={row.key} label={`${projectTitle(row.assignmentId)} AI 대화`} onChange={() => toggle(chatToken(row.key))} />
          ))}
        </SelectionSection>

        <SelectionSection title="캘린더 일정" count={calendarEvents.length} onSelectAll={() => selectIds(calendarEvents.map((event) => calendarToken(event.id)))}>
          {calendarEvents.map((event) => (
            <CheckRow checked={selectedIds.includes(calendarToken(event.id))} description={`${event.date}${event.time ? ` ${event.time}` : ""} · ${calendarTypeLabel(event.type)}${event.project ? ` · ${event.project}` : ""}`} key={event.id} label={event.title} onChange={() => toggle(calendarToken(event.id))} />
          ))}
        </SelectionSection>

        <SelectionSection title="업로드 원본 파일" count={fileRows.length} onSelectAll={() => selectIds(fileRows.map((file) => fileToken(file.key)))}>
          {fileRows.map((file) => (
            <CheckRow checked={selectedIds.includes(fileToken(file.key))} description={`${formatBytes(file.size)} · ${file.storage === "opfs" ? "기기 파일 저장소" : "IndexedDB"} · ${projectTitle(file.assignmentId)}`} key={file.key} label={file.name} onChange={() => toggle(fileToken(file.key))} />
          ))}
        </SelectionSection>

        <SelectionSection title="앱 설정" count={preferenceRows.length} onSelectAll={() => selectIds(preferenceRows.map((entry) => preferenceToken(entry.key)))}>
          {preferenceRows.map((entry) => (
            <CheckRow checked={selectedIds.includes(preferenceToken(entry.key))} description={`${preferenceDescription(entry.key)} · ${formatBytes(entry.bytes)}`} key={entry.key} label={preferenceLabel(entry.key)} onChange={() => toggle(preferenceToken(entry.key))} />
          ))}
        </SelectionSection>

        <SelectionSection title="현재 탭 임시 작업 상태" count={sessionRows.length} onSelectAll={() => selectIds(sessionRows.map((entry) => sessionToken(entry.key)))}>
          {sessionRows.map((entry) => (
            <CheckRow checked={selectedIds.includes(sessionToken(entry.key))} description={`현재 탭에서 사용하는 임시 데이터 · ${formatBytes(entry.bytes)}`} key={entry.key} label={entry.label} onChange={() => toggle(sessionToken(entry.key))} />
          ))}
        </SelectionSection>

        <button className="mt-4 min-h-12 w-full rounded-2xl bg-rose-600 px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={busy || selectedIds.length === 0} onClick={() => void deleteSelectedData()} type="button">
          선택한 {selectedIds.length}개 삭제
        </button>
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">프로젝트만 선택하면 해당 프로젝트 본문만 삭제됩니다. AI 대화와 업로드 파일도 같이 지우려면 ‘연결 데이터 함께 선택’을 사용하세요.</p>
      </Panel>

      <Panel title="공통 개인화 설정 초기화" description="학교급·학년·교육과정·AI 설명 선호만 초기화합니다. 이 기기의 수행평가 프로젝트와 파일은 건드리지 않습니다.">
        <button className={secondaryButton} disabled={busy} onClick={() => void resetSharedPersonalization()} type="button">공통 개인화만 초기화</button>
      </Panel>
      <Panel title="현재 계정의 개인 작업 전체 삭제" description="현재 로그인 계정에 속한 로컬 프로젝트, AI 대화, 캘린더와 업로드 원본을 한 번에 삭제합니다. 다른 계정의 로컬 데이터와 시험온 공통 개인화는 유지합니다.">
        <button className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-black text-rose-700 disabled:opacity-50" disabled={busy} onClick={() => void deleteLocalData()} type="button">{confirmDelete ? "정말 전체 삭제" : "이 기기의 개인 작업 전체 삭제"}</button>
      </Panel>
      <Message value={message} />
    </div>
  );
}

function SelectionSection({ title, count, onSelectAll, children }: { title: string; count: number; onSelectAll: () => void; children: ReactNode }) {
  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-black text-slate-800">{title} <span className="text-slate-400">{count}</span></h3>
        <button className={tinyButton} disabled={!count} onClick={onSelectAll} type="button">이 항목 전체 선택</button>
      </div>
      {count ? <div className="divide-y divide-slate-100">{children}</div> : <p className="px-4 py-4 text-sm font-semibold text-slate-400">저장된 항목이 없습니다.</p>}
    </section>
  );
}

function CheckRow({ checked, label, description, onChange, trailing }: { checked: boolean; label: string; description: string; onChange: () => void; trailing?: ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition ${checked ? "bg-rose-50/70" : "bg-white hover:bg-slate-50"}`}>
      <input checked={checked} className="mt-1 size-4 accent-rose-600" onChange={onChange} type="checkbox" />
      <span className="min-w-0 flex-1">
        <span className="block break-words text-sm font-black text-slate-900">{label}</span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">{description}</span>
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </label>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-slate-950">{title}</h2><p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p><div className="mt-4">{children}</div></section>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black text-slate-400">{label}</p><p className="mt-1 font-black text-slate-900">{value}</p></div>; }
function Message({ value }: { value: string }) { return value ? <p className="rounded-2xl bg-violet-50 p-3 text-sm font-bold leading-6 text-violet-800">{value}</p> : null; }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`; if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${(bytes / 1024 ** 3).toFixed(1)} GB`; }
function formatDate(timestamp: number) { return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(new Date(timestamp)); }
function localDateToken() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function projectToken(id: string) { return `project:${id}`; }
function chatToken(key: string) { return `chat:${key}`; }
function calendarToken(id: string) { return `calendar:${id}`; }
function fileToken(key: string) { return `file:${key}`; }
function preferenceToken(key: string) { return `preference:${key}`; }
function sessionToken(key: string) { return `session:${key}`; }
function stageLabel(stage: AssignmentProject["stage"]) { return { setup: "설정", topic: "주제 선정", research: "자료 조사", plan: "계획", draft: "초고", final: "완성본" }[stage]; }
function calendarTypeLabel(type: CalendarEvent["type"]) { return { deadline: "마감일", presentation: "발표", exam: "시험", checkpoint: "중간 점검", todo: "할 일" }[type]; }
function preferenceLabel(key: string) {
  const labels: Record<string, string> = {
    "assessment-theme": "화면 테마",
    "assessment-font-size": "글자 크기",
    "assessment-reduce-motion": "모션 줄이기",
    "assessment-high-contrast": "고대비 화면",
    "assessment-large-controls": "큰 조작 요소",
    "assessment-haptics": "진동 설정",
    "assessment-notifications": "알림 설정",
    "assessment-data-saver": "데이터 절약 설정",
    "assessment-fast-response": "빠른 반응 설정",
    "assessment-keep-awake": "화면 켜짐 유지",
    "assessment-start-page": "시작 화면",
    "assessment-default-curriculum": "기본 교육과정",
    "assessment-default-school-level": "기본 학교급",
    "assessment-default-grade": "기본 학년",
    "assessment-default-assignment-type": "기본 수행평가 유형",
    "assessment-file-name-format": "파일명 형식",
    "assessment-file-name-prefix": "파일명 앞글자",
    "assessment-file-name-separator": "파일명 구분자",
    "assessment-file-name-example": "파일명 예시",
    "assessment-cache-cleanup-days": "캐시 자동 정리 기간",
    "assessment-cache-limit-mb": "캐시 최대 용량",
  };
  return labels[key] ?? "앱 로컬 설정";
}
function preferenceDescription(key: string) {
  if (key.includes("default-")) return "새 수행평가 기본값";
  if (key.includes("file-name")) return "파일 저장 이름 설정";
  if (key.includes("cache")) return "저장공간 자동 정리 설정";
  if (key.includes("theme") || key.includes("font") || key.includes("contrast") || key.includes("motion")) return "화면 표시 설정";
  return "앱 동작 설정";
}
const primaryButton = "min-h-11 rounded-xl bg-violet-700 px-4 text-sm font-black text-white disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50";
const smallButton = "inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 disabled:opacity-40";
const tinyButton = "inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[0.7rem] font-black text-slate-600 disabled:opacity-40";
