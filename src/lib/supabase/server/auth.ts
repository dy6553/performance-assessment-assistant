import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { ACCESS_COOKIE, authCookieOptions, REFRESH_COOKIE } from "../auth-cookies";

export type AuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: AuthUser;
};

type AuthErrorBody = {
  error_description?: string;
  msg?: string;
  message?: string;
};

function authConfig() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.sb_public_key
  )?.trim();

  if (!baseUrl || !publishableKey) throw new Error("SUPABASE_AUTH_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), publishableKey };
}

async function authRequest<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<{ data?: T; status: number; message?: string }> {
  const { baseUrl, publishableKey } = authConfig();
  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: publishableKey,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as AuthErrorBody;
    return {
      status: response.status,
      message: body.error_description ?? body.msg ?? body.message,
    };
  }

  if (response.status === 204) return { status: response.status };
  return { status: response.status, data: (await response.json()) as T };
}

async function setSessionCookies(session: AuthSession) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, session.access_token, {
    ...authCookieOptions,
    maxAge: session.expires_in,
  });
  store.set(REFRESH_COOKIE, session.refresh_token, {
    ...authCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signInWithPassword(email: string, password: string) {
  const response = await authRequest<AuthSession>("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.data) return { ok: false as const, status: response.status };
  await setSessionCookies(response.data);
  return { ok: true as const, user: response.data.user };
}

export async function signUpWithPassword(email: string, password: string, nickname: string) {
  const response = await authRequest<Partial<AuthSession> & { user: AuthUser }>("signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { nickname } }),
  });

  if (!response.data) return { ok: false as const, status: response.status };
  if (response.data.access_token && response.data.refresh_token && response.data.expires_in) {
    await setSessionCookies(response.data as AuthSession);
    return { ok: true as const, needsEmailConfirmation: false };
  }

  return { ok: true as const, needsEmailConfirmation: true };
}

async function readAuthenticatedUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    const response = await authRequest<AuthUser>("user", { accessToken });
    return response.data ?? null;
  } catch {
    return null;
  }
}

export const getAuthenticatedUser = cache(readAuthenticatedUser);

export async function signOutCurrentUser() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    await authRequest("logout", { method: "POST", accessToken }).catch(() => undefined);
  }

  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}
