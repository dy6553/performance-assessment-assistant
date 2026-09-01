"use server";

import { redirect } from "next/navigation";

import { signInWithPassword, signOutCurrentUser } from "@/lib/supabase/server/auth";

export type DeveloperLoginState = { message: string };
const DEVELOPER_ID_RE = /^[a-zA-Z0-9_-]{3,32}$/;

function developerEmail(developerId: string) {
  return `dev.${developerId.toLowerCase()}@performance-assessment.test.invalid`;
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

  if (result.user.user_metadata?.account_type !== "developer_test" || result.user.user_metadata?.developer_id !== developerId) {
    await signOutCurrentUser();
    return { message: "개발자 테스트 계정이 아닙니다." };
  }

  redirect(developerId.toLowerCase() === "i123" ? "/admin" : "/");
}
