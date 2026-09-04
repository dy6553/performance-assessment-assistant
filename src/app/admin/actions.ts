"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/admin/server/auth";
import type { AccountStatus, UserRole } from "@/features/admin/types";

const accountStatuses = new Set<AccountStatus>(["ACTIVE", "LIMITED", "SUSPENDED"]);
const userRoles = new Set<UserRole>(["USER", "ADMIN", "SUPER_ADMIN"]);

export async function updateUserStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "") as AccountStatus;
  if (!userId || !accountStatuses.has(status)) return;
  if (userId === admin.user.id && status !== "ACTIVE") return;

  await admin.repository.updateAccountStatus(userId, status);
  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: `사용자 상태를 ${status}로 변경`,
    target_type: "USER",
    target_id: userId,
    reason: null,
    metadata: { status },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function updateUserRoleAction(formData: FormData) {
  const admin = await requireAdmin("SUPER_ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  if (!userId || !userRoles.has(role)) return;
  if (userId === admin.user.id && role !== "SUPER_ADMIN") return;

  await admin.repository.updateUserRole(userId, role);
  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: `사용자 권한을 ${role}로 변경`,
    target_type: "USER",
    target_id: userId,
    reason: null,
    metadata: { role },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function deleteUserAccountAction(formData: FormData) {
  const admin = await requireAdmin("SUPER_ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (!userId || confirmation !== "DELETE") return { ok: false, message: "삭제 확인이 올바르지 않습니다." };
  if (userId === admin.user.id) return { ok: false, message: "현재 로그인한 관리자 계정은 삭제할 수 없습니다." };

  const target = await admin.repository.getUser(userId);
  if (!target) return { ok: false, message: "삭제할 계정을 찾을 수 없습니다." };

  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: "사용자 계정 영구 삭제",
    target_type: "USER",
    target_id: userId,
    reason: null,
    metadata: {
      role: target.role,
      developerId: target.developerId,
      accountStatus: target.status,
    },
  });
  await admin.repository.deleteUserAccount(userId);

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/developers");
  return { ok: true, message: "계정을 삭제했습니다." };
}

export async function updateModelFlagAction(formData: FormData) {
  const admin = await requireAdmin("SUPER_ADMIN");
  const modelId = String(formData.get("modelId") ?? "");
  const field = String(formData.get("field") ?? "");
  const value = String(formData.get("value") ?? "") === "true";
  if (!modelId || (field !== "enabled" && field !== "production_approved")) return;

  await admin.repository.updateModelFlag(modelId, field, value);
  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: `AI 모델 ${field} 값을 ${value ? "활성" : "비활성"}으로 변경`,
    target_type: "AI_MODEL",
    target_id: modelId,
    reason: null,
    metadata: { field, value },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/ai-models");
  revalidatePath("/admin/services");
}
