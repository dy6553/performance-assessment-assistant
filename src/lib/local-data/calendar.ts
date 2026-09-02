"use client";

import { idbGet, idbGetAll, idbPut } from "./db";

export type LocalCalendarRecord<T = unknown> = {
  key: string;
  ownerId: string;
  events: T[];
  notified: Record<string, number>;
  updatedAt: number;
};

function calendarKey(ownerId: string) {
  return `calendar:${ownerId}`;
}

export async function readLocalCalendar<T>(ownerId: string) {
  const row = await idbGet<LocalCalendarRecord<T>>("calendar", calendarKey(ownerId));
  return row?.ownerId === ownerId ? row : null;
}

export async function saveLocalCalendar<T>(
  ownerId: string,
  events: T[],
  notified: Record<string, number> = {},
) {
  await idbPut("calendar", {
    key: calendarKey(ownerId),
    ownerId,
    events,
    notified,
    updatedAt: Date.now(),
  } satisfies LocalCalendarRecord<T>);
}

export async function listLocalCalendars(ownerId: string) {
  const rows = await idbGetAll<LocalCalendarRecord>("calendar");
  return rows.filter((row) => row.ownerId === ownerId);
}
