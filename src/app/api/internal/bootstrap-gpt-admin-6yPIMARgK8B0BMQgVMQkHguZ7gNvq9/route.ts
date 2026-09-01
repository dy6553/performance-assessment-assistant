import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";

const DEVELOPER_ID = "gpt-admin";
const EMAIL = `dev.${DEVELOPER_ID}@performance-assessment.test.invalid`;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generatePassword() {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

function config() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.sb_secret_key)?.trim();
  if (!baseUrl || !secretKey) throw new Error("ADMIN_SUPABASE_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey };
}

async function adminRequest(path: string, init: RequestInit = {}) {
  const { baseUrl, secretKey } = config();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status}:${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export async function GET() {
  try {
    const password = generatePassword();
    const listed = await adminRequest("/auth/v1/admin/users?page=1&per_page=1000") as { users?: Array<{ id: string; email?: string }> };
    let user = listed.users?.find((candidate) => candidate.email?.toLowerCase() === EMAIL) ?? null;

    const payload = {
      password,
      user_metadata: {
        account_type: "developer_test",
        developer_id: DEVELOPER_ID,
        developer_approved: true,
      },
      app_metadata: {
        account_type: "gpt_admin",
        role: "SUPER_ADMIN",
      },
    };

    if (!user) {
      user = await adminRequest("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ email: EMAIL, email_confirm: true, ...payload }),
      }) as { id: string; email?: string };
    } else {
      await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    }

    await adminRequest(`/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ account_status: "ACTIVE", role: "SUPER_ADMIN" }),
    });

    return NextResponse.json({ ok: true, developerId: DEVELOPER_ID, password });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "UNKNOWN" }, { status: 500 });
  }
}
