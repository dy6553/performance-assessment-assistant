"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { assessmentFlowStorageKey } from "@/features/assessment/assessment-flow";
import type { AssignmentInput } from "@/features/assessment/schemas";

import {
  eventTimestamp,
  eventTypeLabel,
  readCalendarEvents,
  type CalendarEvent,
  type CalendarEventType,
  writeCalendarEvents,
} from "./calendar-storage";

type EventDraft = Omit<CalendarEvent, "id" | "createdAt">;

const eventTypes: CalendarEventType[] = ["deadline", "presentation", "exam", "checkpoint", "todo"];
const weekDays = ["일", "월", "화", "수", "목", "금", "토"];

export function AssessmentCalendar() {
  const today = startOfDay(new Date());
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EventDraft>(() => emptyDraft(toDateInput(today), readProjectName()));
  const [notificationState, setNotificationState] = useState<NotificationPermission | "unsupported">("default");
  const [storageError, setStorageError] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setEvents(readCalendarEvents());
      setNotificationState("Notification" in window ? Notification.permission : "unsupported");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);
  const upcoming = useMemo(() => events
    .filter((event) => !event.completed && eventTimestamp(event) >= today.getTime())
    .sort((a, b) => eventTimestamp(a) - eventTimestamp(b))
    .slice(0, 8), [events, today]);

  function openCreate(date = toDateInput(today)) {
    setEditingId(null);
    setDraft(emptyDraft(date, readProjectName()));
    setEditorOpen(true);
    setStorageError("");
  }

  function openEdit(event: CalendarEvent) {
    setEditingId(event.id);
    setDraft({
      title: event.title,
      date: event.date,
      time: event.time,
      type: event.type,
      project: event.project,
      notes: event.notes,
      reminderMinutes: event.reminderMinutes,
      completed: event.completed,
    });
    setEditorOpen(true);
    setStorageError("");
  }

  function saveEvent() {
    if (!draft.title.trim() || !draft.date) {
      setStorageError("일정 이름과 날짜를 입력해 주세요.");
      return;
    }

    const nextEvent: CalendarEvent = {
      ...draft,
      title: draft.title.trim(),
      project: draft.project.trim(),
      notes: draft.notes.trim(),
      id: editingId ?? crypto.randomUUID(),
      createdAt: editingId ? events.find((event) => event.id === editingId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    };
    const next = editingId
      ? events.map((event) => event.id === editingId ? nextEvent : event)
      : [...events, nextEvent];
    persist(next);
    setEditorOpen(false);
  }

  function removeEvent() {
    if (!editingId) return;
    persist(events.filter((event) => event.id !== editingId));
    setEditorOpen(false);
  }

  function toggleComplete(event: CalendarEvent) {
    persist(events.map((item) => item.id === event.id ? { ...item, completed: !item.completed } : item));
  }

  function persist(next: CalendarEvent[]) {
    try {
      writeCalendarEvents(next);
      setEvents(next);
      setStorageError("");
    } catch {
      setStorageError("이 브라우저에 일정을 저장하지 못했습니다.");
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationState("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">일정과 할 일</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-4xl">수행평가 캘린더</h1>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">마감일, 발표, 시험, 중간 점검과 단계별 할 일을 한곳에서 관리하세요.</p>
        </div>
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-5 text-sm font-black text-white shadow-md transition hover:bg-violet-800" onClick={() => openCreate()} type="button">
          <span className="text-lg">＋</span> 일정 등록
        </button>
      </header>

      <section className="mt-6 flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-violet-700"><Icon className="size-5" name="bell" /></span>
          <div>
            <p className="text-sm font-black text-violet-950">일정 알림</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-violet-700">알림을 허용하면 앱이 열려 있거나 설치된 앱을 사용하는 동안 설정한 시각에 알려드립니다.</p>
          </div>
        </div>
        {notificationState === "granted" ? (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-800">알림 허용됨</span>
        ) : (
          <button className="min-h-10 shrink-0 rounded-xl border border-violet-300 bg-white px-4 text-xs font-black text-violet-800 disabled:opacity-50" disabled={notificationState === "denied" || notificationState === "unsupported"} onClick={() => void enableNotifications()} type="button">
            {notificationState === "denied" ? "브라우저 설정에서 허용 필요" : notificationState === "unsupported" ? "알림 미지원" : "알림 허용"}
          </button>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
            <button aria-label="이전 달" className="grid size-11 place-items-center rounded-xl border border-slate-200 text-xl font-black text-slate-700" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} type="button">‹</button>
            <div className="text-center">
              <h2 className="text-xl font-black text-slate-950">{month.getFullYear()}년 {month.getMonth() + 1}월</h2>
              <button className="mt-1 text-xs font-black text-violet-600" onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))} type="button">오늘로 이동</button>
            </div>
            <button aria-label="다음 달" className="grid size-11 place-items-center rounded-xl border border-slate-200 text-xl font-black text-slate-700" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} type="button">›</button>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {weekDays.map((day, index) => <div className={`py-2.5 text-center text-xs font-black ${index === 0 ? "text-rose-500" : index === 6 ? "text-sky-600" : "text-slate-500"}`} key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((date) => {
              const key = toDateInput(date);
              const dayEvents = events.filter((event) => event.date === key).sort((a, b) => a.time.localeCompare(b.time));
              const inMonth = date.getMonth() === month.getMonth();
              const isToday = key === toDateInput(today);
              return (
                <button className={`min-h-24 border-b border-r border-slate-100 p-1.5 text-left align-top transition hover:bg-violet-50 sm:min-h-32 sm:p-2 ${inMonth ? "bg-white" : "bg-slate-50/60"}`} key={key} onClick={() => openCreate(key)} type="button">
                  <span className={`grid size-7 place-items-center rounded-full text-xs font-black ${isToday ? "bg-violet-700 text-white" : inMonth ? "text-slate-700" : "text-slate-300"}`}>{date.getDate()}</span>
                  <span className="mt-1 block space-y-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span className={`block truncate rounded-md px-1.5 py-1 text-[0.65rem] font-black ${event.completed ? "bg-slate-100 text-slate-400 line-through" : typeClass(event.type)}`} key={event.id} onClick={(clickEvent) => { clickEvent.stopPropagation(); openEdit(event); }}>{event.time ? `${event.time} ` : ""}{event.title}</span>
                    ))}
                    {dayEvents.length > 3 ? <span className="block px-1 text-[0.65rem] font-black text-slate-400">+{dayEvents.length - 3}개</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">가까운 일정</h2>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-black text-violet-700">{upcoming.length}</span>
            </div>
            {upcoming.length ? (
              <div className="mt-4 space-y-3">
                {upcoming.map((event) => (
                  <article className="rounded-2xl border border-slate-200 p-3" key={event.id}>
                    <div className="flex items-start gap-3">
                      <button aria-label={`${event.title} 완료 상태 변경`} className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border ${event.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`} onClick={() => toggleComplete(event)} type="button">{event.completed ? "✓" : ""}</button>
                      <button className="min-w-0 flex-1 text-left" onClick={() => openEdit(event)} type="button">
                        <span className="block text-xs font-black text-violet-600">{eventTypeLabel(event.type)} · {formatShortDate(event.date, event.time)}</span>
                        <span className="mt-1 block truncate text-sm font-black text-slate-900">{event.title}</span>
                        {event.project ? <span className="mt-1 block truncate text-xs font-semibold text-slate-500">{event.project}</span> : null}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">등록된 가까운 일정이 없습니다.</p>}
          </section>

          <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="text-sm font-black text-emerald-900">단계별 일정 예시</h2>
            <ol className="mt-3 space-y-2 text-xs font-semibold leading-5 text-emerald-800">
              <li>1. 주제 선정</li><li>2. 자료 조사 완료</li><li>3. 초안 작성</li><li>4. AI 최종 피드백</li><li>5. 제출</li>
            </ol>
          </section>
        </aside>
      </div>

      {storageError && !editorOpen ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{storageError}</p> : null}

      {editorOpen ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/40 p-3 backdrop-blur-sm sm:grid sm:place-items-center" role="presentation">
          <section aria-label={editingId ? "일정 수정" : "일정 등록"} aria-modal="true" className="mx-auto mt-4 max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-white p-5 shadow-2xl sm:mt-0 sm:p-6" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black text-violet-600">수행평가 일정</p><h2 className="mt-1 text-2xl font-black text-slate-950">{editingId ? "일정 수정" : "새 일정 등록"}</h2></div>
              <button aria-label="닫기" className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-600" onClick={() => setEditorOpen(false)} type="button"><Icon className="size-5" name="close" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="일정 이름"><input autoFocus className={inputClass} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="예: 국어 수행평가 제출" value={draft.title} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="날짜"><input className={inputClass} onChange={(event) => setDraft({ ...draft, date: event.target.value })} type="date" value={draft.date} /></Field>
                <Field label="시간"><input className={inputClass} onChange={(event) => setDraft({ ...draft, time: event.target.value })} type="time" value={draft.time} /></Field>
              </div>
              <Field label="일정 종류"><select className={inputClass} onChange={(event) => setDraft({ ...draft, type: event.target.value as CalendarEventType })} value={draft.type}>{eventTypes.map((type) => <option key={type} value={type}>{eventTypeLabel(type)}</option>)}</select></Field>
              <Field label="연결할 수행평가 프로젝트"><input className={inputClass} maxLength={160} onChange={(event) => setDraft({ ...draft, project: event.target.value })} placeholder="예: 국어 주장하는 글쓰기" value={draft.project} /></Field>
              <Field label="알림"><select className={inputClass} onChange={(event) => setDraft({ ...draft, reminderMinutes: event.target.value === "none" ? null : Number(event.target.value) })} value={draft.reminderMinutes ?? "none"}><option value="none">알림 없음</option><option value="0">일정 시간</option><option value="10">10분 전</option><option value="30">30분 전</option><option value="60">1시간 전</option><option value="1440">하루 전</option></select></Field>
              <Field label="메모"><textarea className={`${inputClass} min-h-24 resize-y`} maxLength={1000} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="준비물이나 해야 할 일을 적어 주세요." value={draft.notes} /></Field>
              {editingId ? <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-black text-slate-700"><input checked={draft.completed} className="size-4" onChange={(event) => setDraft({ ...draft, completed: event.target.checked })} type="checkbox" /> 완료한 일정으로 표시</label> : null}
              {storageError ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{storageError}</p> : null}
            </div>

            <div className="mt-6 flex gap-2">
              {editingId ? <button className="min-h-12 rounded-xl border border-rose-200 px-4 text-sm font-black text-rose-700" onClick={removeEvent} type="button">삭제</button> : null}
              <button className="min-h-12 flex-1 rounded-xl bg-violet-700 px-5 text-sm font-black text-white" onClick={saveEvent} type="button">{editingId ? "수정 저장" : "일정 등록"}</button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function emptyDraft(date: string, project: string): EventDraft {
  return { title: "", date, time: "17:00", type: "deadline", project, notes: "", reminderMinutes: 1440, completed: false };
}

function readProjectName() {
  try {
    const raw = window.sessionStorage.getItem(assessmentFlowStorageKey);
    const assignment = raw ? JSON.parse(raw) as Partial<AssignmentInput> : null;
    return assignment?.topic?.trim() || assignment?.subject?.trim() || "";
  } catch { return ""; }
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
}

function startOfDay(date: Date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function toDateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatShortDate(date: string, time: string) { const value = new Date(`${date}T${time || "09:00"}:00`); return `${value.getMonth() + 1}월 ${value.getDate()}일 ${time || "09:00"}`; }
function typeClass(type: CalendarEventType) { return { deadline: "bg-rose-100 text-rose-700", presentation: "bg-violet-100 text-violet-700", exam: "bg-amber-100 text-amber-800", checkpoint: "bg-sky-100 text-sky-700", todo: "bg-emerald-100 text-emerald-700" }[type]; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-black text-slate-700">{label}</span>{children}</label>; }
const inputClass = "min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100";
