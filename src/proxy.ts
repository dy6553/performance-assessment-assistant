import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SECONDARY_HOST = "wanhee-wonhee3.vercel.app";
const CANONICAL_ORIGIN = "https://wanhee-two.vercel.app";

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  const { pathname, search } = request.nextUrl;

  if (host === SECONDARY_HOST) {
    return NextResponse.redirect(new URL(`${pathname}${search}`, CANONICAL_ORIGIN), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
