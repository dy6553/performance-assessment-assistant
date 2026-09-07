import "server-only";

import { cookies } from "next/headers";

import { ACCESS_COOKIE } from "@/lib/supabase/auth-cookies";

const CANONICAL_PERSONALIZATION_URL =
  process.env.EXAM_ON_PERSONALIZATION_URL ||
  "https://siheomon-study-app-six.vercel.app/api/personalization/shared";

export type SharedPersonalizationProfile = {
  defaultPublisher?: string | null;
};

export async function readSharedPersonalization(): Promise<SharedPersonalizationProfile | null> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) return null;
  try {
    const response = await fetch(CANONICAL_PERSONALIZATION_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as { profile?: SharedPersonalizationProfile | null } | null;
    return payload?.profile ?? null;
  } catch {
    return null;
  }
}

export async function updateSharedDefaultPublisher(defaultPublisher: string): Promise<boolean> {
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!accessToken) return false;
  try {
    const response = await fetch(CANONICAL_PERSONALIZATION_URL, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ defaultPublisher }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
