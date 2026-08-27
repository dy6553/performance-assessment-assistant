import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECONDARY_HOST = "wanhee-wonhee3.vercel.app";
const CANONICAL_ORIGIN = "https://wanhee-two.vercel.app";

function isPwaControlPath(pathname: string) {
  return pathname === "/pwa-control" || pathname.startsWith("/pwa-control/");
}

function isPwaControlAsset(pathname: string) {
  return pathname === "/icons/icon-192.png" || pathname === "/icons/icon-512.png";
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const { pathname, search } = request.nextUrl;

  if (
    host === SECONDARY_HOST &&
    !isPwaControlPath(pathname) &&
    !isPwaControlAsset(pathname)
  ) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, CANONICAL_ORIGIN), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
