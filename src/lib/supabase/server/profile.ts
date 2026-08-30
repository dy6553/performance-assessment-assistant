import "server-only";

import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "../auth-cookies";

export type UserProfile = {
  user_id: string;
  nickname: string;
  school_name: string;
  school_key: string;
  age: number | null;
  created_at: string;
  updated_at: string;
};

function profileConfig() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.sb_public_key
  )?.trim();

  if (!baseUrl || !publishableKey) throw new Error("SUPABASE_PROFILE_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), publishableKey };
}

async function getAccessToken() {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

async function profileRequest(path: string, init: RequestInit = {}) {
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("AUTH_REQUIRED");

  const { baseUrl, publishableKey } = profileConfig();
  return fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  try {
    const response = await profileRequest(
      "user_profiles?select=user_id,nickname,school_name,school_key,age,created_at,updated_at&limit=1",
    );
    if (!response.ok) return null;

    const rows = (await response.json()) as UserProfile[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function updateCurrentUserProfile(input: {
  nickname: string;
  schoolName: string;
  age: number;
}) {
  const response = await profileRequest("rpc/set_my_profile", {
    method: "POST",
    body: JSON.stringify({
      p_nickname: input.nickname,
      p_school_name: input.schoolName,
      p_age: input.age,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; details?: string };
    throw new Error(body.message ?? body.details ?? "PROFILE_UPDATE_FAILED");
  }
}

export function makeSchoolStorageScope(userId: string, profile: UserProfile | null) {
  const schoolKey = profile?.school_key?.trim() || "unassigned";
  return `${userId}:${schoolKey}`;
}
