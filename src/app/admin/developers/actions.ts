"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/admin/server/auth";

const DEVELOPER_ID_RE = /^[a-zA-Z0-9_-]{3,32}$/;

function config() {
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.supabase_URL)?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.sb_secret_key)?.trim();
  if (!baseUrl || !secretKey) throw new Error("ADMIN_SUPABASE_CONFIGURATION");
  return { baseUrl: baseUrl.replace(/\/$/, ""), secretKey };
}

function developerEmail(developerId: string) {
  return `dev.${developerId.toLowerCase()}@performance-assessment.test.invalid`;
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
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`DEVELOPER_ACCOUNT_REQUEST_${response.status}:${text.slice(0, 160)}`);
  return text ? JSON.parse(text) : null;
}

export async function createDeveloperAccountAction(formData: FormData) {
  const admin = await requireAdmin("SUPER_ADMIN");
  const developerId = String(formData.get("developerId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!DEVELOPER_ID_RE.test(developerId) || password.length < 12) return;

  const user = await adminRequest("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: developerEmail(developerId),
      password,
      email_confirm: true,
      user_metadata: {
        account_type: "developer_test",
        developer_id: developerId,
        developer_approved: false,
      },
    }),
  }) as { id: string };

  await admin.repository.updateAccountStatus(user.id, "LIMITED");
  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: "개발자 테스트 계정 생성(승인 대기)",
    target_type: "USER",
    target_id: user.id,
    reason: null,
    metadata: { developerId },
  });
  revalidatePath("/admin/developers");
  revalidatePath("/admin/users");
}

export async function approveDeveloperAccountAction(formData: FormData) {
  const admin = await requireAdmin("SUPER_ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const developerId = String(formData.get("developerId") ?? "");
  if (!userId || !DEVELOPER_ID_RE.test(developerId)) return;

  await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({
      user_metadata: {
        account_type: "developer_test",
        developer_id: developerId,
        developer_approved: true,
      },
    }),
  });
  await admin.repository.updateAccountStatus(userId, "ACTIVE");
  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: "개발자 테스트 계정 승인",
    target_type: "USER",
    target_id: userId,
    reason: null,
    metadata: { developerId },
  });
  revalidatePath("/admin/developers");
  revalidatePath("/admin/users");
}

export async function revokeDeveloperAccountAction(formData: FormData) {
  const admin = await requireAdmin("SUPER_ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const developerId = String(formData.get("developerId") ?? "");
  if (!userId || !DEVELOPER_ID_RE.test(developerId)) return;

  await adminRequest(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({
      user_metadata: {
        account_type: "developer_test",
        developer_id: developerId,
        developer_approved: false,
      },
    }),
  });
  await admin.repository.updateAccountStatus(userId, "LIMITED");
  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: "개발자 테스트 계정 승인 해제",
    target_type: "USER",
    target_id: userId,
    reason: null,
    metadata: { developerId },
  });
  revalidatePath("/admin/developers");
  revalidatePath("/admin/users");
}
