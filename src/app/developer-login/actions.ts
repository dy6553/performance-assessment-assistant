"use server";

import { redirect } from "next/navigation";

import { signInWithPassword, signOutCurrentUser } from "@/lib/supabase/server/auth";

export type DeveloperLoginState = { message: string };
const DEVELOPER_ID_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const GPT_ADMIN_ID = "i123";
const GPT_ADMIN_LEGACY_ID = "gpt-admin";
const GPT_ADMIN_INTERNAL_EMAIL = "dev.gpt-admin@performance-assessment.test.invalid";

function developerEmail(developerId: string) {
  const normalized = developerId.toLowerCase();
  if (normalized === GPT_ADMIN_ID) return GPT_ADMIN_INTERNAL_EMAIL;
  return `dev.${normalized}@performance-assessment.test.invalid`;
}

function developerIdMatches(requestedId: string, storedId: unknown) {
  if (typeof storedId !== "string") return false;
  if (storedId === requestedId) return true;
  return requestedId.toLowerCase() === GPT_ADMIN_ID && storedId.toLowerCase() === GPT_ADMIN_LEGACY_ID;
}

export async function developerLoginAction(
  _state: DeveloperLoginState,
  formData: FormData,
): Promise<DeveloperLoginState> {
  const developerId = String(formData.get("developerId") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!DEVELOPER_ID_RE.test(developerId) || password.length < 8) {
    return { message: "개발자 ID 또는 비밀번호 형식을 확인해 주세요." };
  }

  const result = await signInWithPassword(developerEmail(developerId), password).catch(() => null);
  if (!result?.ok) {
    return { message: result?.status === 403 ? "아직 관리자 승인이 완료되지 않았습니다." : "개발자 ID 또는 비밀번호를 확인해 주세요." };
  }

  if (
    result.user.user_metadata?.account_type !== "developer_test" ||
    !developerIdMatches(developerId, result.user.user_metadata?.developer_id)
  ) {
    await signOutCurrentUser();
    return { message: "개발자 테스트 계정이 아닙니다." };
  }

  redirect(developerId.toLowerCase() === GPT_ADMIN_ID ? "/admin" : "/");
}
