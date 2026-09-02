import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/supabase/auth-cookies";
import { getAuthenticatedUser } from "@/lib/supabase/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CANONICAL_PERSONALIZATION_URL =
  process.env.EXAM_ON_PERSONALIZATION_URL ||
  "https://siheomon-study-app-six.vercel.app/api/personalization/shared";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ profile: null }, { status: 401, headers: noStoreHeaders() });

  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  if (!accessToken) return Response.json({ profile: null }, { status: 401, headers: noStoreHeaders() });

  try {
    const response = await fetch(CANONICAL_PERSONALIZATION_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return Response.json({ profile: null }, { headers: noStoreHeaders() });
    const payload = (await response.json()) as { profile?: unknown };
    return Response.json({ profile: payload.profile ?? null }, { headers: noStoreHeaders() });
  } catch {
    return Response.json({ profile: null }, { headers: noStoreHeaders() });
  }
}

function noStoreHeaders() {
  return { "Cache-Control": "private, no-store" };
}
