"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/features/admin/server/auth";
import { AdminAssignmentDataRepository } from "@/features/admin/server/assignment-data-repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function deleteAssignmentDataAction(formData: FormData) {
  const admin = await requireAdmin("SUPER_ADMIN");
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();
  if (!UUID_RE.test(assignmentId)) return { ok: false, message: "삭제할 수행평가 ID가 올바르지 않습니다." };
  if (String(formData.get("confirm") ?? "") !== "DELETE") return { ok: false, message: "삭제 확인이 필요합니다." };

  const repository = new AdminAssignmentDataRepository();
  const deleted = await repository.deleteAssignment(assignmentId);
  if (!deleted) return { ok: false, message: "수행평가 데이터를 찾을 수 없습니다." };

  await admin.repository.addAuditLog({
    admin_user_id: admin.user.id,
    action: "ASSIGNMENT_DATA_DELETED",
    target_type: "SYSTEM",
    target_id: deleted.id,
    reason: "관리자 수행평가 데이터 화면에서 직접 삭제",
    metadata: {
      userId: deleted.userId,
      subject: deleted.subject,
      topic: deleted.topic,
      assignmentType: deleted.assignmentType,
      status: deleted.status,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/database");
  revalidatePath("/admin/files");
  revalidatePath("/admin/users");
  return { ok: true, message: "수행평가와 연결 데이터를 삭제했습니다." };
}
