import { NextResponse } from "next/server";

const DEVELOPER_ID = "gpt-admin";
const PASSWORD = "ye7b5bGL";
const EMAIL = `dev.${DEVELOPER_ID}@performance-assessment.test.invalid`;

function config() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
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
    const listed = await adminRequest("/auth/v1/admin/users?page=1&per_page=1000") as { users?: Array<{ id: string; email?: string }> };
    let user = listed.users?.find((candidate) => candidate.email?.toLowerCase() === EMAIL) ?? null;

    if (!user) {
      user = await adminRequest("/auth/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: EMAIL,
          password: PASSWORD,
          email_confirm: true,
          user_metadata: {
            account_type: "developer_test",
            developer_id: DEVELOPER_ID,
            developer_approved: true,
          },
          app_metadata: {
            account_type: "gpt_admin",
            role: "SUPER_ADMIN",
          },
        }),
      }) as { id: string; email?: string };
    } else {
      await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          password: PASSWORD,
          user_metadata: {
            account_type: "developer_test",
            developer_id: DEVELOPER_ID,
            developer_approved: true,
          },
          app_metadata: {
            account_type: "gpt_admin",
            role: "SUPER_ADMIN",
          },
        }),
      });
    }

    await adminRequest(`/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ account_status: "ACTIVE", role: "SUPER_ADMIN" }),
    });

    return NextResponse.json({ ok: true, developerId: DEVELOPER_ID });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "UNKNOWN" }, { status: 500 });
  }
}
