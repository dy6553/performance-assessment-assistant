import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, authCookieOptions, REFRESH_COOKIE } from "@/lib/supabase/auth-cookies";

type RefreshedSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type AccountStatusRow = {
  account_status: "ACTIVE" | "LIMITED" | "SUSPENDED";
};

const SECONDARY_HOST = "wanhee-wonhee3.vercel.app";
const CANONICAL_ORIGIN = "https://wanhee-two.vercel.app";

const protectedPrefixes = [
  "/account",
  "/admin",
  "/ai-tools",
  "/assignment",
  "/grader",
  "/settings",
  "/topic-recommender",
  "/api/assignment",
];

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const { pathname, search } = request.nextUrl;

  if (host === SECONDARY_HOST) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, CANONICAL_ORIGIN), 308);
  }

  const protectedRoute = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  let refreshed: RefreshedSession | null = null;
  let clearStaleSession = false;

  if (!accessToken || expiresSoon(accessToken)) {
    if (refreshToken) {
      refreshed = await refreshSession(refreshToken);
      accessToken = refreshed?.access_token;
      if (refreshed) {
        request.cookies.set(ACCESS_COOKIE, refreshed.access_token);
      } else {
        clearStaleSession = true;
      }
    } else if (accessToken) {
      accessToken = undefined;
      clearStaleSession = true;
    }
  }

  if (clearStaleSession) {
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
  }

  if (protectedRoute && accessToken && (await isSuspended(accessToken))) {
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    const response = pathname.startsWith("/api/")
      ? NextResponse.json(
          { error: "관리자에 의해 사용이 정지된 계정입니다." },
          { status: 403, headers: { "Cache-Control": "private, no-store" } },
        )
      : NextResponse.redirect(buildLoginUrl(request, `${pathname}${search}`, "suspended"));
    clearSessionCookies(response);
    return response;
  }

  if (protectedRoute && !accessToken) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json(
          { error: "로그인 후 이용해 주세요." },
          { status: 401, headers: { "Cache-Control": "private, no-store" } },
        )
      : NextResponse.redirect(buildLoginUrl(request, `${pathname}${search}`));

    if (clearStaleSession) clearSessionCookies(response);
    return response;
  }

  const response = NextResponse.next({ request });
  if (refreshed) {
    response.cookies.set(ACCESS_COOKIE, refreshed.access_token, {
      ...authCookieOptions,
      maxAge: refreshed.expires_in,
    });
    response.cookies.set(REFRESH_COOKIE, refreshed.refresh_token, {
      ...authCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  } else if (clearStaleSession) {
    clearSessionCookies(response);
  }

  return response;
}

function buildLoginUrl(request: NextRequest, nextPath: string, reason?: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", nextPath);
  if (reason) loginUrl.searchParams.set("reason", reason);
  return loginUrl;
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
}

function expiresSoon(token: string): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { exp?: number };
    return !payload.exp || payload.exp <= Math.floor(Date.now() / 1_000) + 60;
  } catch {
    return true;
  }
}

function supabasePublicConfig() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.sb_public_key
  )?.trim();
  if (!baseUrl || !publishableKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ""), publishableKey };
}

async function isSuspended(accessToken: string): Promise<boolean> {
  const config = supabasePublicConfig();
  if (!config) return false;

  try {
    const response = await fetch(`${config.baseUrl}/rest/v1/user_profiles?select=account_status&limit=1`, {
      headers: {
        Accept: "application/json",
        apikey: config.publishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const rows = (await response.json()) as AccountStatusRow[];
    return rows[0]?.account_status === "SUSPENDED";
  } catch {
    return false;
  }
}

async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  const config = supabasePublicConfig();
  if (!config) return null;

  try {
    const response = await fetch(
      `${config.baseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          apikey: config.publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) return null;
    return (await response.json()) as RefreshedSession;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|sw.js).*)"],
};
