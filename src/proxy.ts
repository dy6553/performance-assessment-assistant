import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, authCookieOptions, REFRESH_COOKIE } from "@/lib/supabase/auth-cookies";

type RefreshedSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

const SECONDARY_HOST = "wanhee-wonhee3.vercel.app";
const CANONICAL_ORIGIN = "https://wanhee-two.vercel.app";

const protectedPrefixes = [
  "/account",
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

  if ((!accessToken || expiresSoon(accessToken)) && refreshToken) {
    refreshed = await refreshSession(refreshToken);
    accessToken = refreshed?.access_token;
    if (refreshed) request.cookies.set(ACCESS_COOKIE, refreshed.access_token);
  }

  if (protectedRoute && !accessToken) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "로그인 후 이용해 주세요." },
        { status: 401, headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
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
  }

  return response;
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

async function refreshSession(refreshToken: string): Promise<RefreshedSession | null> {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.sb_public_key
  )?.trim();

  if (!baseUrl || !publishableKey) return null;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          apikey: publishableKey,
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
