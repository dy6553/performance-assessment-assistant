"use client";

import { idbDelete, idbGet, idbGetAll, idbPut } from "./db";

export type LocalChatMessage = { role: "user" | "assistant"; content: string };
export type LocalChatRecord = {
  key: string;
  ownerId: string;
  assignmentId: string;
  messages: LocalChatMessage[];
  updatedAt: number;
};

function chatKey(ownerId: string, assignmentId: string) {
  return `${ownerId}:${assignmentId}`;
}

export async function readProjectChat(ownerId: string, assignmentId: string) {
  const row = await idbGet<LocalChatRecord>("chats", chatKey(ownerId, assignmentId));
  return row?.ownerId === ownerId ? row.messages : [];
}

export async function saveProjectChat(ownerId: string, assignmentId: string, messages: LocalChatMessage[]) {
  await idbPut("chats", {
    key: chatKey(ownerId, assignmentId),
    ownerId,
    assignmentId,
    messages: messages.slice(-100),
    updatedAt: Date.now(),
  } satisfies LocalChatRecord);
}

export async function deleteProjectChat(ownerId: string, assignmentId: string) {
  await idbDelete("chats", chatKey(ownerId, assignmentId));
}

export async function listProjectChats(ownerId: string) {
  const rows = await idbGetAll<LocalChatRecord>("chats");
  return rows.filter((row) => row.ownerId === ownerId);
}
