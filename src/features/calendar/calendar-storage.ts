export const calendarStorageKey = "assessment-calendar-events-v1";
export const calendarNotificationStorageKey = "assessment-calendar-notified-v1";

export type CalendarEventType = "deadline" | "presentation" | "exam" | "checkpoint" | "todo";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: CalendarEventType;
  project: string;
  notes: string;
  reminderMinutes: number | null;
  completed: boolean;
  createdAt: string;
};

export function readCalendarEvents(): CalendarEvent[] {
  try {
    const raw = window.localStorage.getItem(calendarStorageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isCalendarEvent) : [];
  } catch {
    return [];
  }
}

export function writeCalendarEvents(events: CalendarEvent[]) {
  window.localStorage.setItem(calendarStorageKey, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent("assessment-calendar-updated"));
}

export function eventTimestamp(event: CalendarEvent) {
  return new Date(`${event.date}T${event.time || "09:00"}:00`).getTime();
}

export function eventTypeLabel(type: CalendarEventType) {
  return {
    deadline: "마감일",
    presentation: "발표",
    exam: "시험",
    checkpoint: "중간 점검",
    todo: "할 일",
  }[type];
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CalendarEvent>;
  return typeof event.id === "string" && typeof event.title === "string" && typeof event.date === "string";
}
