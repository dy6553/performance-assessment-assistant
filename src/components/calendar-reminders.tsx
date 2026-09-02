"use client";

import { useEffect } from "react";

import {
  calendarNotificationStorageKey,
  eventTimestamp,
  eventTypeLabel,
  readCalendarEvents,
} from "@/features/calendar/calendar-storage";

export function CalendarReminders() {
  useEffect(() => {
    function checkReminders() {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      const now = Date.now();
      const notified = readNotified();
      let changed = false;
      for (const event of readCalendarEvents()) {
        if (event.completed || event.reminderMinutes === null) continue;
        const reminderAt = eventTimestamp(event) - event.reminderMinutes * 60_000;
        const notificationKey = `${event.id}:${reminderAt}`;
        if (notified[notificationKey] || reminderAt > now || now - reminderAt > 12 * 60 * 60 * 1000) continue;

        new Notification(`${eventTypeLabel(event.type)} · ${event.title}`, {
          body: event.project ? `${event.project} · ${formatDateTime(event.date, event.time)}` : formatDateTime(event.date, event.time),
          icon: "/icon-192.png",
          tag: notificationKey,
        });
        notified[notificationKey] = now;
        changed = true;
      }
      if (changed) window.localStorage.setItem(calendarNotificationStorageKey, JSON.stringify(notified));
    }

    checkReminders();
    const timer = window.setInterval(checkReminders, 30_000);
    window.addEventListener("assessment-calendar-updated", checkReminders);
    document.addEventListener("visibilitychange", checkReminders);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("assessment-calendar-updated", checkReminders);
      document.removeEventListener("visibilitychange", checkReminders);
    };
  }, []);

  return null;
}

function readNotified(): Record<string, number> {
  try {
    const raw = window.localStorage.getItem(calendarNotificationStorageKey);
    const value = raw ? JSON.parse(raw) : {};
    return value && typeof value === "object" ? value as Record<string, number> : {};
  } catch {
    return {};
  }
}

function formatDateTime(date: string, time: string) {
  return `${date.replaceAll("-", ".")} ${time || "09:00"}`;
}
