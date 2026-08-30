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

type AccountStatusRow = {
  account_status: "ACTIVE" | "LIMITED" | "SUSPENDED";
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

function appOrigin() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost) {
    return (productionHost.startsWith("http") ? productionHost : `https://${productionHost}`).replace(
      /\/$/,
      "",
    );
  }

  if (process.env.NODE_ENV === "production") return "https://wanhee-two.vercel.app";
  return "http://localhost:3000";
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

async function readAccountStatus(accessToken: string): Promise<AccountStatusRow["account_status"] | null> {
  const { baseUrl, publishableKey } = authConfig();
  try {
    const response = await fetch(`${baseUrl}/rest/v1/user_profiles?select=account_status&limit=1`, {
      headers: {
        Accept: "application/json",
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const rows = (await response.json()) as AccountStatusRow[];
    return rows[0]?.account_status ?? null;
  } catch {
    return null;
  }
}

async function setSessionTokenCookies(accessToken: string, refreshToken: string, expiresIn: number) {
  const store = await cookies();
  const safeExpiresIn = Number.isFinite(expiresIn)
    ? Math.min(Math.max(Math.floor(expiresIn), 60), 60 * 60 * 24)
    : 60 * 60;

  store.set(ACCESS_COOKIE, accessToken, {
    ...authCookieOptions,
    maxAge: safeExpiresIn,
  });
  store.set(REFRESH_COOKIE, refreshToken, {
    ...authCookieOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

async function setSessionCookies(session: AuthSession) {
  await setSessionTokenCookies(session.access_token, session.refresh_token, session.expires_in);
}

export async function signInWithPassword(email: string, password: string) {
  const response = await authRequest<AuthSession>("token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.data) return { ok: false as const, status: response.status };
  if ((await readAccountStatus(response.data.access_token)) === "SUSPENDED") {
    return { ok: false as const, status: 403 };
  }
  await setSessionCookies(response.data);
  return { ok: true as const, user: response.data.user };
}

export async function signUpWithPassword(email: string, password: string, nickname: string) {
  const confirmationRedirect = `${appOrigin()}/auth/callback`;
  const response = await authRequest<Partial<AuthSession> & { user: AuthUser }>(
    `signup?redirect_to=${encodeURIComponent(confirmationRedirect)}`,
    {
      method: "POST",
      body: JSON.stringify({ email, password, data: { nickname } }),
    },
  );

  if (!response.data) return { ok: false as const, status: response.status };
  if (response.data.access_token && response.data.refresh_token && response.data.expires_in) {
    const session = response.data as AuthSession;
    if ((await readAccountStatus(session.access_token)) === "SUSPENDED") {
      return { ok: false as const, status: 403 };
    }
    await setSessionCookies(session);
    return { ok: true as const, needsEmailConfirmation: false };
  }

  return { ok: true as const, needsEmailConfirmation: true };
}

export async function establishSessionFromConfirmation(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
) {
  if (!accessToken || !refreshToken) return false;

  try {
    const response = await authRequest<AuthUser>("user", { accessToken });
    if (!response.data) return false;
    if ((await readAccountStatus(accessToken)) === "SUSPENDED") return false;
    await setSessionTokenCookies(accessToken, refreshToken, expiresIn);
    return true;
  } catch {
    return false;
  }
}

async function readAuthenticatedUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;

  try {
    const response = await authRequest<AuthUser>("user", { accessToken });
    if (!response.data) return null;
    if ((await readAccountStatus(accessToken)) === "SUSPENDED") return null;
    return response.data;
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
